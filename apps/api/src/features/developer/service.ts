import { randomUUID } from "node:crypto";
import { toBase64 } from "@mysten/bcs";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { z } from "zod";
import {
  CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD,
  CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER,
  CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD,
  CELERIS_CHAIN_FAMILY_SUI,
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  CELERIS_NETWORK_TESTNET,
  type AuthSession,
  authLoginCompletionSchema,
  authProviderSchema,
  authTokenExchangeSchema,
  chainIdSchema,
  type ConfigureSayHelloInput,
  configureSayHelloSchema,
  type CreateAuthLoginRequestInput,
  createAuthLoginRequestSchema,
  type CreateCheckoutSessionInput,
  createCheckoutSessionSchema,
  type CreateDeveloperAppInput,
  createDeveloperAppSchema,
  type CompleteSayHelloInput,
  completeSayHelloSchema,
  type DeveloperApp,
  type ExecuteSayHelloInput,
  executeSayHelloSchema,
  assertHelloCelerisTransactionKindValueMatches,
  buildCanonicalHelloCelerisSayHelloTransaction,
  registerProgramSchema,
  type RegisterProgramInput,
  deriveZkLoginSalt,
  deriveZkLoginWalletAddress
} from "@celeris/shared";
import { badGateway, badRequest, conflict, notFound, unauthorized } from "../../lib/http-error";
import { decryptSecret, encryptSecret, generateOpaqueToken, sha256 } from "./crypto";
import type {
  AuthLoginRequestRecord,
  CheckoutSessionRecord,
  DeveloperAppAggregateRecord,
  DeveloperProfileRecord,
  ManagedActionRecord,
  PendingActionReservationRecord,
  RegisteredProgramRecord,
  SponsorWalletRecord,
  TransactionRecordRecord,
  UserSessionAggregateRecord,
  DeveloperSetupRepository
} from "./repository";
import { createPrismaDeveloperSetupRepository } from "./repository";

const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;
const ACTION_RESERVATION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DASHBOARD_ZKLOGIN_MAX_EPOCH = 2;
const DEFAULT_SUI_GAS_BUDGET = 50_000_000;
const ZKLOGIN_SALT_UPPER_BOUND = 2n ** 128n;
const zGoogleCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

export interface VerifiedGoogleIdentity {
  issuer: string;
  subject: string;
  email: string;
  displayName: string | null;
  audience: string;
  nonce: string | null;
}

export interface GoogleOAuthClient {
  createAuthorizationUrl(input: { state: string; nonce?: string | null }): string;
  exchangeCodeForIdToken(code: string): Promise<string>;
  verifyIdToken(idToken: string, expectedAudience: string): Promise<VerifiedGoogleIdentity>;
}

export interface ZkLoginProver {
  requestProof(input: {
    jwt: string;
    extendedEphemeralPublicKey: string | null;
    maxEpoch: number | null;
    jwtRandomness: string | null;
    salt: string;
  }): Promise<Record<string, unknown> | null>;
}

export interface SponsoredTransactionPayload {
  transactionBytes: string;
  sponsorSignature: string;
  sponsorAddress: string;
  gasCoin: {
    objectId: string;
    version: string;
    digest: string;
  };
}

export interface SuiSponsorAdapter {
  createSponsoredSayHello(input: {
    transaction: ReturnType<typeof buildCanonicalHelloCelerisSayHelloTransaction>["transaction"];
    userWalletAddress: string;
    sponsorWallet: SponsorWalletRecord;
    encryptionKey: string;
  }): Promise<SponsoredTransactionPayload>;
  verifyTransaction(input: { digest: string; expectedSender: string }): Promise<{ confirmedAt: Date }>;
}

export interface DeveloperSetupServiceOptions {
  repository?: DeveloperSetupRepository;
  encryptionKey: string;
  apiOrigin: string;
  hostedAuthOrigin: string;
  developerAppOrigin: string;
  demoFrontendOrigin: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  googleIssuer?: string;
  zkLoginSaltSeed?: string;
  zkLoginProverOrigin?: string;
  zkLoginMaxEpochWindow?: number;
  googleOAuthClient?: GoogleOAuthClient;
  zkLoginProver?: ZkLoginProver;
  suiSponsorAdapter?: SuiSponsorAdapter;
  suiRpcOrigin?: string;
  allowTestIdentityCompletion?: boolean;
}

function requireOption(value: string | number | undefined, label: string) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }

  return value;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function toDeveloperProfile(record: DeveloperProfileRecord) {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName
  };
}

function toRuntimeConfig(options: Pick<DeveloperSetupServiceOptions, "apiOrigin" | "hostedAuthOrigin" | "demoFrontendOrigin">) {
  return {
    apiOrigin: options.apiOrigin,
    hostedAuthOrigin: options.hostedAuthOrigin,
    demoOrigin: options.demoFrontendOrigin
  };
}

function toSponsorWallet(record: SponsorWalletRecord) {
  return {
    chainFamily: CELERIS_CHAIN_FAMILY_SUI,
    network: CELERIS_NETWORK_TESTNET,
    address: record.address,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toRegisteredProgram(record: RegisteredProgramRecord) {
  return {
    chainFamily: CELERIS_CHAIN_FAMILY_SUI,
    network: CELERIS_NETWORK_TESTNET,
    packageId: record.packageId,
    appStateObjectId: record.appStateObjectId,
    authorityCapObjectId: record.authorityCapObjectId,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toManagedAction(record: ManagedActionRecord) {
  return {
    actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
    priceCredits: record.priceCredits,
    isEnabled: record.isEnabled,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toCatalogAction(record: ManagedActionRecord) {
  return {
    actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
    priceCredits: record.priceCredits,
    isEnabled: record.isEnabled
  };
}

function toDeveloperApp(
  aggregate: DeveloperAppAggregateRecord,
  runtimeConfig: Pick<DeveloperSetupServiceOptions, "apiOrigin" | "hostedAuthOrigin" | "demoFrontendOrigin">
): DeveloperApp {
  return {
    appId: aggregate.app.id,
    name: aggregate.app.name,
    slug: aggregate.app.slug,
    allowedChainId: chainIdSchema.parse(aggregate.app.allowedChainId),
    authProvider: authProviderSchema.parse(aggregate.app.authProvider),
    createdAt: toIsoString(aggregate.app.createdAt),
    updatedAt: toIsoString(aggregate.app.updatedAt),
    sponsorWallet: aggregate.sponsorWallet ? toSponsorWallet(aggregate.sponsorWallet) : null,
    registeredProgram: aggregate.registeredProgram ? toRegisteredProgram(aggregate.registeredProgram) : null,
    sayHelloAction: aggregate.sayHelloAction ? toManagedAction(aggregate.sayHelloAction) : null,
    sdkConfig: {
      appId: aggregate.app.id,
      allowedChainId: chainIdSchema.parse(aggregate.app.allowedChainId),
      authProvider: authProviderSchema.parse(aggregate.app.authProvider),
      apiOrigin: runtimeConfig.apiOrigin,
      hostedAuthOrigin: runtimeConfig.hostedAuthOrigin,
      demoOrigin: runtimeConfig.demoFrontendOrigin
    }
  };
}

function toBalance(input: { appId: string; walletAddress: string; chainId: string; availableCredits: number }) {
  return {
    appId: input.appId,
    walletAddress: input.walletAddress,
    chainId: chainIdSchema.parse(input.chainId),
    availableCredits: input.availableCredits
  };
}

function slugifyName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "celeris-app";
}

function parseOrigin(value: string) {
  return new URL(value).origin;
}

function parseProofInputs(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

function isValidZkLoginSalt(value: string) {
  try {
    const salt = BigInt(value);
    return salt >= 0n && salt < ZKLOGIN_SALT_UPPER_BOUND;
  } catch {
    return false;
  }
}

function getFetchFailureDetails(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeRecord = cause && typeof cause === "object" ? (cause as Record<string, unknown>) : null;

  return {
    error: error instanceof Error ? error.message : String(error),
    causeCode: typeof causeRecord?.code === "string" ? causeRecord.code : null,
    causeSyscall: typeof causeRecord?.syscall === "string" ? causeRecord.syscall : null,
    causeHostname: typeof causeRecord?.hostname === "string" ? causeRecord.hostname : null
  };
}

async function getResponseErrorDetails(response: Response) {
  const contentType = response.headers.get("content-type");
  const body = await response.text();
  let parsed: unknown = null;

  if (body) {
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      parsed = body.slice(0, 500);
    }
  }

  return {
    upstreamStatusCode: response.status,
    upstreamStatusText: response.statusText,
    upstreamContentType: contentType,
    upstreamBody: parsed
  };
}

type AppConsumerSession = Pick<AuthSession, "clientKind" | "appId"> & {
  user: Pick<AuthSession["user"], "walletAddress">;
};

class RuntimeSuiSponsorAdapter implements SuiSponsorAdapter {
  private readonly client: SuiClient;

  constructor(suiRpcOrigin: string) {
    this.client = new SuiClient({
      url: suiRpcOrigin
    });
  }

  async createSponsoredSayHello(input: {
    transaction: ReturnType<typeof buildCanonicalHelloCelerisSayHelloTransaction>["transaction"];
    userWalletAddress: string;
    sponsorWallet: SponsorWalletRecord;
    encryptionKey: string;
  }) {
    const keypair = Ed25519Keypair.fromSecretKey(decryptSecret(input.sponsorWallet.encryptedSecret, input.encryptionKey));
    const sponsorAddress = keypair.toSuiAddress();
    const coins = await this.client.getCoins({
      owner: sponsorAddress,
      coinType: "0x2::sui::SUI",
      limit: 1
    });
    const gasCoin = coins.data[0];

    if (!gasCoin) {
      throw badGateway("Sponsor wallet has no SUI gas coins");
    }

    input.transaction.setSender(input.userWalletAddress);
    input.transaction.setGasOwner(sponsorAddress);
    input.transaction.setGasBudget(DEFAULT_SUI_GAS_BUDGET);
    input.transaction.setGasPayment([
      {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest
      }
    ]);

    const bytes = await input.transaction.build({
      client: this.client
    });
    const { signature } = await keypair.signTransaction(bytes);

    return {
      transactionBytes: toBase64(bytes),
      sponsorSignature: signature,
      sponsorAddress,
      gasCoin: {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest
      }
    };
  }

  async verifyTransaction(input: { digest: string; expectedSender: string }) {
    const response = await this.client.getTransactionBlock({
      digest: input.digest,
      options: {
        showInput: true,
        showEffects: true
      }
    });

    if (response.effects?.status.status !== "success") {
      throw badRequest("Submitted transaction did not succeed");
    }

    if (response.transaction?.data.sender && response.transaction.data.sender !== input.expectedSender) {
      throw badRequest("Submitted transaction sender does not match the active session");
    }

    return {
      confirmedAt: response.timestampMs ? new Date(Number(response.timestampMs)) : new Date()
    };
  }
}

class RuntimeGoogleOAuthClient implements GoogleOAuthClient {
  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      issuer: string;
    }
  ) {}

  createAuthorizationUrl(input: { state: string; nonce?: string | null }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", this.options.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("prompt", "select_account");

    if (input.nonce) {
      url.searchParams.set("nonce", input.nonce);
    }

    return url.toString();
  }

  async exchangeCodeForIdToken(code: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        redirect_uri: this.options.redirectUri,
        grant_type: "authorization_code"
      })
    }).catch((error: unknown) => {
      throw badGateway("Google OAuth token exchange failed", getFetchFailureDetails(error));
    });
    const payload = (await response.json()) as { id_token?: unknown; error_description?: unknown };

    if (!response.ok || typeof payload.id_token !== "string") {
      throw unauthorized(
        typeof payload.error_description === "string" ? payload.error_description : "Google token exchange failed"
      );
    }

    return payload.id_token;
  }

  async verifyIdToken(idToken: string, expectedAudience: string) {
    const url = new URL("https://oauth2.googleapis.com/tokeninfo");
    url.searchParams.set("id_token", idToken);
    const response = await fetch(url).catch((error: unknown) => {
      throw badGateway("Google ID token verification failed", getFetchFailureDetails(error));
    });
    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw unauthorized("Invalid Google ID token");
    }

    const issuer = typeof payload.iss === "string" ? payload.iss : "";
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const audience = typeof payload.aud === "string" ? payload.aud : "";

    if (!subject || !email || audience !== expectedAudience || issuer !== this.options.issuer) {
      throw unauthorized("Invalid Google ID token");
    }

    return {
      issuer,
      subject,
      email,
      displayName: typeof payload.name === "string" ? payload.name : null,
      audience,
      nonce: typeof payload.nonce === "string" ? payload.nonce : null
    };
  }
}

class RuntimeZkLoginProver implements ZkLoginProver {
  constructor(private readonly proverOrigin: string) {}

  async requestProof(input: {
    jwt: string;
    extendedEphemeralPublicKey: string | null;
    maxEpoch: number | null;
    jwtRandomness: string | null;
    salt: string;
  }) {
    if (!input.extendedEphemeralPublicKey || input.maxEpoch === null || !input.jwtRandomness) {
      return null;
    }

    const response = await fetch(new URL("/v1", this.proverOrigin), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jwt: input.jwt,
        extendedEphemeralPublicKey: input.extendedEphemeralPublicKey,
        maxEpoch: String(input.maxEpoch),
        jwtRandomness: input.jwtRandomness,
        salt: input.salt,
        keyClaimName: "sub"
      })
    }).catch((error: unknown) => {
      throw badGateway("zkLogin prover request failed", getFetchFailureDetails(error));
    });

    if (!response.ok) {
      throw unauthorized("zkLogin prover rejected the Google identity", await getResponseErrorDetails(response));
    }

    const payload = (await response.json()) as unknown;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw unauthorized("zkLogin prover returned an invalid response");
    }

    return payload as Record<string, unknown>;
  }
}

export class DeveloperSetupService {
  private readonly repository: DeveloperSetupRepository;
  private readonly encryptionKey: string;
  private readonly apiOrigin: string;
  private readonly hostedAuthOrigin: string;
  private readonly developerAppOrigin: string;
  private readonly demoFrontendOrigin: string;
  private readonly googleClientId: string;
  private readonly googleIssuer: string;
  private readonly zkLoginSaltSeed: string;
  private readonly zkLoginMaxEpochWindow: number;
  private readonly googleOAuthClient: GoogleOAuthClient;
  private readonly zkLoginProver: ZkLoginProver;
  private readonly suiSponsorAdapter: SuiSponsorAdapter;
  private readonly allowTestIdentityCompletion: boolean;

  constructor(options: DeveloperSetupServiceOptions) {
    this.repository = options.repository ?? createPrismaDeveloperSetupRepository();
    this.encryptionKey = options.encryptionKey;
    this.apiOrigin = options.apiOrigin;
    this.hostedAuthOrigin = options.hostedAuthOrigin;
    this.developerAppOrigin = options.developerAppOrigin;
    this.demoFrontendOrigin = options.demoFrontendOrigin;
    this.googleClientId = String(requireOption(options.googleClientId, "googleClientId"));
    this.googleIssuer = String(requireOption(options.googleIssuer, "googleIssuer"));
    this.zkLoginSaltSeed = String(requireOption(options.zkLoginSaltSeed, "zkLoginSaltSeed"));
    this.zkLoginMaxEpochWindow = options.zkLoginMaxEpochWindow ?? DEFAULT_DASHBOARD_ZKLOGIN_MAX_EPOCH;
    this.googleOAuthClient =
      options.googleOAuthClient ??
      new RuntimeGoogleOAuthClient({
        clientId: this.googleClientId,
        clientSecret: String(requireOption(options.googleClientSecret, "googleClientSecret")),
        redirectUri: String(requireOption(options.googleRedirectUri, "googleRedirectUri")),
        issuer: this.googleIssuer
      });
    this.zkLoginProver =
      options.zkLoginProver ??
      new RuntimeZkLoginProver(String(requireOption(options.zkLoginProverOrigin, "zkLoginProverOrigin")));
    this.suiSponsorAdapter =
      options.suiSponsorAdapter ??
      new RuntimeSuiSponsorAdapter(options.suiRpcOrigin ?? "https://fullnode.testnet.sui.io:443");
    this.allowTestIdentityCompletion = options.allowTestIdentityCompletion ?? false;
  }

  async createLoginRequest(input: CreateAuthLoginRequestInput) {
    const payload = createAuthLoginRequestSchema.parse(input);
    const redirectOrigin = parseOrigin(payload.redirectUri);

    if (payload.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD) {
      if (payload.clientId !== CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD) {
        throw badRequest("Unsupported dashboard auth client");
      }

      if (payload.appId) {
        throw badRequest("Dashboard auth must not be app-scoped");
      }

      if (redirectOrigin !== parseOrigin(this.developerAppOrigin)) {
        throw badRequest("Dashboard redirect URI must target the developer app origin");
      }
    } else if (payload.clientKind === CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER) {
      if (!payload.appId) {
        throw badRequest("App consumer auth must include an appId");
      }

      if (payload.clientId !== payload.appId) {
        throw badRequest("App consumer clientId must match appId");
      }

      const app = await this.repository.findAppById(payload.appId);

      if (!app) {
        throw badRequest("Unknown app auth audience");
      }

      if (redirectOrigin !== parseOrigin(this.demoFrontendOrigin)) {
        throw badRequest("App consumer redirect URI must target the demo origin");
      }
    } else {
      throw badRequest("Unsupported auth client kind");
    }

    const record = await this.repository.createAuthLoginRequest({
      clientKind: payload.clientKind,
      clientId: payload.clientId,
      appId: payload.clientKind === CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER ? payload.appId : null,
      state: randomUUID(),
      oauthState: randomUUID(),
      redirectUri: payload.redirectUri,
      nonce: payload.zkLogin?.nonce ?? (payload.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD ? randomUUID() : null),
      extendedEphemeralPublicKey: payload.zkLogin?.extendedEphemeralPublicKey ?? null,
      maxEpoch: payload.zkLogin?.maxEpoch ?? (payload.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD ? this.zkLoginMaxEpochWindow : null),
      jwtRandomness: payload.zkLogin?.jwtRandomness ?? null,
      expiresAt: new Date(Date.now() + LOGIN_REQUEST_TTL_MS)
    });

    return {
      loginRequestId: record.id,
      clientKind: payload.clientKind,
      clientId: payload.clientId,
      appId: record.appId,
      redirectUri: payload.redirectUri,
      state: record.state,
      nonce: record.nonce,
      maxEpoch: record.maxEpoch,
      expiresAt: record.expiresAt.toISOString(),
      authUrl: new URL(`/sign-in?loginRequestId=${record.id}`, this.hostedAuthOrigin).toString()
    };
  }

  async getLoginRequest(loginRequestId: string) {
    const request = await this.requireActiveLoginRequest(loginRequestId);

    return {
      loginRequestId: request.id,
      clientKind: request.clientKind,
      clientId: request.clientId,
      appId: request.appId,
      redirectUri: request.redirectUri,
      state: request.state,
      nonce: request.nonce,
      maxEpoch: request.maxEpoch,
      expiresAt: request.expiresAt.toISOString(),
      authUrl: new URL(`/sign-in?loginRequestId=${request.id}`, this.hostedAuthOrigin).toString()
    };
  }

  async completeLoginRequest(loginRequestId: string, input: unknown) {
    if (!this.allowTestIdentityCompletion) {
      throw notFound("Test identity completion is not available");
    }

    const request = await this.requireActiveLoginRequest(loginRequestId);
    const payload = authLoginCompletionSchema.parse(input);

    const userIdentity = await this.resolveUserIdentity({
      issuer: this.googleIssuer,
      subject: payload.email,
      email: payload.email,
      displayName: payload.displayName ?? null,
      audience: this.googleClientId,
      nonce: request.nonce
    });
    if (request.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD) {
      await this.repository.upsertDeveloperProfile({
        userIdentityId: userIdentity.id,
        email: userIdentity.email,
        displayName: userIdentity.displayName
      });
    }

    const authCode = generateOpaqueToken();
    const completed = await this.repository.completeAuthLoginRequest({
      loginRequestId: request.id,
      authCode,
      userIdentityId: userIdentity.id,
      zkLoginProofInputsJson: JSON.stringify({ testOnly: true })
    });

    const redirectTo = new URL(completed.redirectUri);
    redirectTo.searchParams.set("code", authCode);
    redirectTo.searchParams.set("state", completed.state);
    redirectTo.searchParams.set("clientKind", completed.clientKind);
    redirectTo.searchParams.set("clientId", completed.clientId);

    if (completed.appId) {
      redirectTo.searchParams.set("appId", completed.appId);
    }

    return {
      redirectTo: redirectTo.toString()
    };
  }

  async startGoogleOAuth(loginRequestId: string) {
    const request = await this.requireActiveLoginRequest(loginRequestId);

    if (!request.oauthState) {
      throw unauthorized("OAuth state missing");
    }

    return {
      redirectTo: this.googleOAuthClient.createAuthorizationUrl({
        state: request.oauthState,
        nonce: request.nonce
      })
    };
  }

  async completeGoogleOAuth(input: unknown) {
    const payload = zGoogleCallbackSchema.parse(input);
    const request = await this.repository.findAuthLoginRequestByOAuthState(payload.state);

    if (!request || request.status !== "pending") {
      throw unauthorized("Invalid OAuth state");
    }

    if (request.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Login request expired");
    }

    const idToken = await this.googleOAuthClient.exchangeCodeForIdToken(payload.code);
    const googleIdentity = await this.googleOAuthClient.verifyIdToken(idToken, this.googleClientId);

    if (request.nonce && googleIdentity.nonce !== request.nonce) {
      throw unauthorized("Invalid Google ID token nonce");
    }

    const userIdentity = await this.resolveUserIdentity(googleIdentity);
    const proofInputs = await this.zkLoginProver.requestProof({
      jwt: idToken,
      extendedEphemeralPublicKey: request.extendedEphemeralPublicKey,
      maxEpoch: request.maxEpoch,
      jwtRandomness: request.jwtRandomness,
      salt: userIdentity.salt
    });

    if (request.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD) {
      await this.repository.upsertDeveloperProfile({
        userIdentityId: userIdentity.id,
        email: userIdentity.email,
        displayName: userIdentity.displayName
      });
    }

    const authCode = generateOpaqueToken();
    const completed = await this.repository.completeAuthLoginRequest({
      loginRequestId: request.id,
      authCode,
      userIdentityId: userIdentity.id,
      zkLoginProofInputsJson: proofInputs ? JSON.stringify(proofInputs) : null
    });

    const redirectTo = new URL(completed.redirectUri);
    redirectTo.searchParams.set("code", authCode);
    redirectTo.searchParams.set("state", completed.state);
    redirectTo.searchParams.set("clientKind", completed.clientKind);
    redirectTo.searchParams.set("clientId", completed.clientId);

    if (completed.appId) {
      redirectTo.searchParams.set("appId", completed.appId);
    }

    return {
      redirectTo: redirectTo.toString()
    };
  }

  async exchangeToken(input: unknown) {
    const payload = authTokenExchangeSchema.parse(input);
    const request = await this.repository.findAuthLoginRequestByAuthCode(payload.code);

    if (!request || request.state !== payload.state || request.status !== "completed") {
      throw unauthorized("Invalid auth code");
    }

    if (request.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Auth code expired");
    }

    const userIdentity = await this.resolveRequiredUserIdentityForRequest(request);
    const developerProfile =
      request.clientKind === CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD
        ? await this.repository.upsertDeveloperProfile({
            userIdentityId: userIdentity.id,
            email: userIdentity.email,
            displayName: userIdentity.displayName
          })
        : null;

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + USER_SESSION_TTL_MS);
    await this.repository.createUserSession({
      userIdentityId: userIdentity.id,
      clientKind: request.clientKind,
      clientId: request.clientId,
      appId: request.appId,
      walletAddress: userIdentity.walletAddress,
      chainId: "sui:testnet",
      tokenHash: sha256(token),
      zkLoginProofInputsJson: request.zkLoginProofInputsJson,
      expiresAt
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      clientKind: request.clientKind,
      clientId: request.clientId,
      appId: request.appId,
      user: {
        id: userIdentity.id,
        email: userIdentity.email,
        walletAddress: userIdentity.walletAddress
      },
      developerProfile: developerProfile ? toDeveloperProfile(developerProfile) : null,
      zkLogin: {
        nonce: request.nonce,
        extendedEphemeralPublicKey: request.extendedEphemeralPublicKey,
        maxEpoch: request.maxEpoch,
        proofInputs: parseProofInputs(request.zkLoginProofInputsJson)
      }
    };
  }

  async signOut(token: string) {
    await this.repository.deleteUserSessionByTokenHash(sha256(token));
  }

  async getSession(token: string) {
    const session = await this.requireValidSession(token);

    return {
      token,
      expiresAt: session.session.expiresAt.toISOString(),
      clientKind: session.session.clientKind,
      clientId: session.session.clientId,
      appId: session.session.appId,
      user: {
        id: session.userIdentity.id,
        email: session.userIdentity.email,
        walletAddress: session.userIdentity.walletAddress
      },
      developerProfile: session.developerProfile ? toDeveloperProfile(session.developerProfile) : null,
      zkLogin: {
        nonce: null,
        extendedEphemeralPublicKey: null,
        maxEpoch: null,
        proofInputs: parseProofInputs(session.session.zkLoginProofInputsJson)
      }
    };
  }

  async authenticateDeveloper(token: string) {
    const session = await this.requireValidSession(token);

    if (
      session.session.clientKind !== CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD ||
      session.session.clientId !== CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD
    ) {
      throw unauthorized("Developer dashboard session required");
    }

    if (!session.developerProfile) {
      throw unauthorized("Developer profile not found");
    }

    return session.developerProfile;
  }

  async ensureDeveloperProfile(token: string) {
    return toDeveloperProfile(await this.authenticateDeveloper(token));
  }

  async listApps(developerProfileId: string) {
    const apps = await this.repository.listAppsByDeveloperProfileId(developerProfileId);
    return apps.map((app) =>
      toDeveloperApp(app, {
        apiOrigin: this.apiOrigin,
        hostedAuthOrigin: this.hostedAuthOrigin,
        demoFrontendOrigin: this.demoFrontendOrigin
      })
    );
  }

  async createApp(developerProfileId: string, input: CreateDeveloperAppInput) {
    const payload = createDeveloperAppSchema.parse(input);
    const created = await this.repository.createApp({
      developerProfileId,
      name: payload.name,
      slug: `${slugifyName(payload.name)}-${randomUUID().slice(0, 8)}`,
      allowedChainId: payload.allowedChainId,
      authProvider: payload.authProvider
    });

    return toDeveloperApp(created, {
      apiOrigin: this.apiOrigin,
      hostedAuthOrigin: this.hostedAuthOrigin,
      demoFrontendOrigin: this.demoFrontendOrigin
    });
  }

  async getApp(developerProfileId: string, appId: string) {
    const app = await this.requireApp(developerProfileId, appId);
    return toDeveloperApp(app, {
      apiOrigin: this.apiOrigin,
      hostedAuthOrigin: this.hostedAuthOrigin,
      demoFrontendOrigin: this.demoFrontendOrigin
    });
  }

  async provisionSponsorWallet(developerProfileId: string, appId: string) {
    await this.requireApp(developerProfileId, appId);
    const existing = await this.repository.findSponsorWalletByAppId(appId);

    if (existing) {
      return toSponsorWallet(existing);
    }

    const keypair = Ed25519Keypair.generate();
    const wallet = await this.repository.upsertSponsorWallet({
      appId,
      address: keypair.toSuiAddress(),
      encryptedSecret: encryptSecret(keypair.getSecretKey(), this.encryptionKey)
    });

    return toSponsorWallet(wallet);
  }

  async getSponsorWallet(developerProfileId: string, appId: string) {
    await this.requireApp(developerProfileId, appId);
    const wallet = await this.repository.findSponsorWalletByAppId(appId);

    if (!wallet) {
      throw notFound("Sponsor wallet not found");
    }

    return toSponsorWallet(wallet);
  }

  async registerProgram(developerProfileId: string, appId: string, input: RegisterProgramInput) {
    await this.requireApp(developerProfileId, appId);
    const payload = registerProgramSchema.parse(input);
    const program = await this.repository.upsertRegisteredProgram({
      appId,
      packageId: payload.packageId,
      appStateObjectId: payload.appStateObjectId,
      authorityCapObjectId: payload.authorityCapObjectId
    });

    return toRegisteredProgram(program);
  }

  async getRegisteredProgram(developerProfileId: string, appId: string) {
    await this.requireApp(developerProfileId, appId);
    const program = await this.repository.findRegisteredProgramByAppId(appId);

    if (!program) {
      throw notFound("Registered program not found");
    }

    return toRegisteredProgram(program);
  }

  async configureSayHello(developerProfileId: string, appId: string, input: ConfigureSayHelloInput) {
    await this.requireApp(developerProfileId, appId);
    const payload = configureSayHelloSchema.parse(input);
    const action = await this.repository.upsertManagedAction({
      appId,
      priceCredits: payload.priceCredits,
      isEnabled: payload.isEnabled
    });

    return toManagedAction(action);
  }

  async getCatalog(appId: string) {
    const app = await this.requirePublicApp(appId);

    return {
      appId: app.app.id,
      chainId: chainIdSchema.parse(app.app.allowedChainId),
      actions: app.sayHelloAction ? [toCatalogAction(app.sayHelloAction)] : [],
      registeredProgram: app.registeredProgram ? toRegisteredProgram(app.registeredProgram) : null
    };
  }

  async getBalance(session: AppConsumerSession, appId: string) {
    const appConsumer = this.requireAppConsumerSession(session, appId);
    await this.requirePublicApp(appId);
    const availableCredits = await this.repository.getCreditBalance(appId, appConsumer.walletAddress);

    return toBalance({
      appId,
      walletAddress: appConsumer.walletAddress,
      chainId: appConsumer.chainId,
      availableCredits
    });
  }

  async createCheckoutSession(session: AppConsumerSession, appId: string, input: CreateCheckoutSessionInput) {
    const appConsumer = this.requireAppConsumerSession(session, appId);
    await this.requirePublicApp(appId);
    const payload = createCheckoutSessionSchema.parse(input);
    const defaultSuccessUrl = new URL("/", this.demoFrontendOrigin);
    defaultSuccessUrl.searchParams.set("checkout", "success");
    const defaultCancelUrl = new URL("/", this.demoFrontendOrigin);
    defaultCancelUrl.searchParams.set("checkout", "canceled");
    const checkoutSession = await this.repository.createCheckoutSession({
      appId,
      walletAddress: appConsumer.walletAddress,
      chainId: appConsumer.chainId,
      credits: payload.credits,
      successRedirectUrl: payload.successRedirectUrl ?? defaultSuccessUrl.toString(),
      cancelRedirectUrl: payload.cancelRedirectUrl ?? defaultCancelUrl.toString()
    });

    return this.toCheckoutSession(checkoutSession);
  }

  async completeCheckoutSession(session: AppConsumerSession, appId: string, checkoutSessionId: string) {
    const appConsumer = this.requireAppConsumerSession(session, appId);
    await this.requirePublicApp(appId);
    const checkoutSession = await this.repository.completeCheckoutSession({
      appId,
      walletAddress: appConsumer.walletAddress,
      checkoutSessionId
    });

    if (!checkoutSession) {
      throw notFound("Checkout session not found");
    }

    const availableCredits = await this.repository.getCreditBalance(appId, appConsumer.walletAddress);

    return {
      checkoutSession: this.toCheckoutSession(checkoutSession),
      balance: toBalance({
        appId,
        walletAddress: appConsumer.walletAddress,
        chainId: appConsumer.chainId,
        availableCredits
      })
    };
  }

  async executeSayHello(session: AppConsumerSession, appId: string, input: ExecuteSayHelloInput) {
    const appConsumer = this.requireAppConsumerSession(session, appId);
    const app = await this.requirePublicApp(appId);
    const payload = executeSayHelloSchema.parse(input);

    if (!app.registeredProgram) {
      throw badRequest("App Sui program is not registered");
    }

    if (!app.sponsorWallet) {
      throw badRequest("App sponsor wallet is not provisioned");
    }

    if (!app.sayHelloAction?.isEnabled) {
      throw badRequest("say_hello is not enabled for this app");
    }

    const built = buildCanonicalHelloCelerisSayHelloTransaction({
      registeredProgram: app.registeredProgram,
      userWalletAddress: appConsumer.walletAddress,
      username: payload.username
    });

    try {
      assertHelloCelerisTransactionKindValueMatches(payload.transactionKind, {
        packageId: app.registeredProgram.packageId,
        appAuthorityCapObjectId: app.registeredProgram.authorityCapObjectId,
        appStateObjectId: app.registeredProgram.appStateObjectId,
        username: built.normalizedUsername
      });
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : "Invalid transaction kind");
    }

    const sponsored = await this.suiSponsorAdapter.createSponsoredSayHello({
      transaction: built.transaction,
      userWalletAddress: appConsumer.walletAddress,
      sponsorWallet: app.sponsorWallet,
      encryptionKey: this.encryptionKey
    });
    const reservation = await this.repository.createPendingActionReservation({
      appId,
      walletAddress: appConsumer.walletAddress,
      chainId: appConsumer.chainId,
      username: built.normalizedUsername,
      message: built.message,
      creditsReserved: app.sayHelloAction.priceCredits,
      transactionBytes: sponsored.transactionBytes,
      sponsorSignature: sponsored.sponsorSignature,
      sponsorAddress: sponsored.sponsorAddress,
      gasCoin: sponsored.gasCoin,
      expiresAt: new Date(Date.now() + ACTION_RESERVATION_TTL_MS)
    });

    if (!reservation) {
      throw badRequest("Insufficient credits");
    }

    const availableCredits = await this.repository.getCreditBalance(appId, appConsumer.walletAddress);

    return {
      sponsorship: this.toSponsorship(reservation),
      balance: toBalance({
        appId,
        walletAddress: appConsumer.walletAddress,
        chainId: appConsumer.chainId,
        availableCredits
      })
    };
  }

  async completeSayHello(session: AppConsumerSession, appId: string, input: CompleteSayHelloInput) {
    const appConsumer = this.requireAppConsumerSession(session, appId);
    await this.requirePublicApp(appId);
    const payload = completeSayHelloSchema.parse(input);
    const existing = await this.repository.findPendingActionReservationById(appId, payload.reservationId);

    if (!existing || existing.walletAddress !== appConsumer.walletAddress) {
      throw notFound("Action reservation not found");
    }

    if (existing.expiresAt.getTime() <= Date.now() && existing.status === "reserved") {
      payload.outcome = "failed";
    }

    let verifiedAt: Date | undefined;
    let explorerUrl: string | undefined;

    if (payload.outcome === "submitted") {
      if (!payload.digest) {
        throw badRequest("digest is required for submitted transactions");
      }
      const verified = await this.suiSponsorAdapter.verifyTransaction({
        digest: payload.digest,
        expectedSender: appConsumer.walletAddress
      });
      verifiedAt = verified.confirmedAt;
      explorerUrl = this.toExplorerUrl(payload.digest);
    }

    const result = await this.repository.completePendingActionReservation({
      appId,
      walletAddress: appConsumer.walletAddress,
      reservationId: payload.reservationId,
      outcome: payload.outcome,
      digest: payload.digest,
      explorerUrl,
      verifiedAt
    });

    if (!result) {
      throw notFound("Action reservation not found");
    }

    const availableCredits = await this.repository.getCreditBalance(appId, appConsumer.walletAddress);

    return {
      reservationId: result.reservation.id,
      status: result.reservation.status === "captured" ? "captured" : "released",
      balance: toBalance({
        appId,
        walletAddress: appConsumer.walletAddress,
        chainId: appConsumer.chainId,
        availableCredits
      }),
      transaction: result.transaction ? this.toTransactionRecord(result.transaction) : null
    };
  }

  async listTransactions(appId: string) {
    await this.requirePublicApp(appId);
    const records = await this.repository.listTransactions(appId);
    return records.map((record) => this.toTransactionRecord(record));
  }

  private async resolveUserIdentity(identity: VerifiedGoogleIdentity) {
    const existing = await this.repository.findUserIdentityByIssuerSubject(identity.issuer, identity.subject);

    if (existing) {
      if (!isValidZkLoginSalt(existing.salt)) {
        const repaired = this.deriveUserZkLoginMaterial(identity);
        return this.repository.updateUserIdentityZkLogin({
          id: existing.id,
          salt: repaired.salt,
          walletAddress: repaired.walletAddress
        });
      }

      return existing;
    }

    const zkLogin = this.deriveUserZkLoginMaterial(identity);

    return this.repository.createUserIdentity({
      issuer: identity.issuer,
      subject: identity.subject,
      email: identity.email,
      displayName: identity.displayName,
      salt: zkLogin.salt,
      walletAddress: zkLogin.walletAddress
    });
  }

  private deriveUserZkLoginMaterial(identity: VerifiedGoogleIdentity) {
    const salt = deriveZkLoginSalt(this.zkLoginSaltSeed, identity.issuer, identity.subject);

    return {
      salt,
      walletAddress: deriveZkLoginWalletAddress({
        issuer: identity.issuer,
        subject: identity.subject,
        aud: identity.audience,
        salt
      })
    };
  }

  private async resolveRequiredUserIdentityForRequest(request: AuthLoginRequestRecord) {
    if (!request.userIdentityId) {
      throw unauthorized("User identity not found");
    }

    const userIdentity = await this.repository.findUserIdentityById(request.userIdentityId);

    if (!userIdentity) {
      throw unauthorized("User identity not found");
    }

    return userIdentity;
  }

  private async requireActiveLoginRequest(loginRequestId: string) {
    const request = await this.repository.findAuthLoginRequestById(loginRequestId);

    if (!request) {
      throw notFound("Login request not found");
    }

    if (request.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Login request expired");
    }

    if (request.status !== "pending") {
      throw conflict("Login request already completed");
    }

    return request;
  }

  private async requireValidSession(token: string): Promise<UserSessionAggregateRecord> {
    const session = await this.repository.findUserSessionByTokenHash(sha256(token));

    if (!session || session.session.expiresAt.getTime() <= Date.now()) {
      throw unauthorized();
    }

    return session;
  }

  private requireAppConsumerSession(session: AppConsumerSession, appId: string) {
    if (
      session.clientKind !== CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER ||
      session.appId !== appId ||
      !session.user.walletAddress
    ) {
      throw unauthorized("App consumer session required");
    }

    return {
      walletAddress: session.user.walletAddress,
      chainId: "sui:testnet"
    };
  }

  private async requirePublicApp(appId: string) {
    const app = await this.repository.findAppById(appId);

    if (!app) {
      throw notFound("App not found");
    }

    return app;
  }

  private async requireApp(developerProfileId: string, appId: string) {
    const app = await this.repository.findAppByIdForDeveloperProfile(developerProfileId, appId);

    if (!app) {
      throw notFound("App not found");
    }

    return app;
  }

  private toCheckoutSession(record: CheckoutSessionRecord) {
    const checkoutUrl = new URL("/checkout", this.demoFrontendOrigin);
    checkoutUrl.searchParams.set("appId", record.appId);
    checkoutUrl.searchParams.set("checkoutSessionId", record.id);

    return {
      checkoutSessionId: record.id,
      appId: record.appId,
      walletAddress: record.walletAddress,
      chainId: chainIdSchema.parse(record.chainId),
      credits: record.credits,
      status: record.status,
      checkoutUrl: checkoutUrl.toString(),
      successRedirectUrl: record.successRedirectUrl,
      cancelRedirectUrl: record.cancelRedirectUrl,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private toSponsorship(record: PendingActionReservationRecord) {
    return {
      reservationId: record.id,
      transactionBytes: record.transactionBytes,
      sponsorSignature: record.sponsorSignature,
      sponsorAddress: record.sponsorAddress,
      expiresAt: record.expiresAt.toISOString(),
      username: record.username,
      message: record.message
    };
  }

  private toTransactionRecord(record: TransactionRecordRecord) {
    return {
      transactionId: record.id,
      appId: record.appId,
      actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
      walletAddress: record.walletAddress,
      chainId: chainIdSchema.parse(record.chainId),
      username: record.username,
      message: record.message,
      digest: record.digest,
      explorerUrl: record.explorerUrl,
      status: record.status,
      confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString()
    };
  }

  private toExplorerUrl(digest: string) {
    return `https://suiexplorer.com/txblock/${encodeURIComponent(digest)}?network=testnet`;
  }
}

let runtimeDeveloperSetupService: DeveloperSetupService | undefined;

export function createDeveloperSetupService(options: DeveloperSetupServiceOptions) {
  return new DeveloperSetupService(options);
}

export function getRuntimeDeveloperSetupService(
  options: Pick<
    DeveloperSetupServiceOptions,
    | "apiOrigin"
    | "hostedAuthOrigin"
    | "encryptionKey"
    | "developerAppOrigin"
    | "demoFrontendOrigin"
    | "googleClientId"
    | "googleClientSecret"
    | "googleRedirectUri"
    | "googleIssuer"
    | "zkLoginSaltSeed"
    | "zkLoginProverOrigin"
    | "zkLoginMaxEpochWindow"
    | "suiRpcOrigin"
  >
) {
  if (!runtimeDeveloperSetupService) {
    runtimeDeveloperSetupService = createDeveloperSetupService(options);
  }

  return runtimeDeveloperSetupService;
}
