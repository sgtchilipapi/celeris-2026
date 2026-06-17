import { randomUUID } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { z } from "zod";
import {
  CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD,
  CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER,
  CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD,
  CELERIS_CHAIN_FAMILY_SUI,
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  CELERIS_NETWORK_TESTNET,
  authLoginCompletionSchema,
  authProviderSchema,
  authTokenExchangeSchema,
  chainIdSchema,
  type ConfigureSayHelloInput,
  configureSayHelloSchema,
  type CreateAuthLoginRequestInput,
  createAuthLoginRequestSchema,
  type CreateDeveloperAppInput,
  createDeveloperAppSchema,
  type DeveloperApp,
  registerProgramSchema,
  type RegisterProgramInput,
  deriveZkLoginSalt,
  deriveZkLoginWalletAddress
} from "@celeris/shared";
import { badRequest, conflict, notFound, unauthorized } from "../../lib/http-error";
import { encryptSecret, generateOpaqueToken, sha256 } from "./crypto";
import type {
  AuthLoginRequestRecord,
  DeveloperAppAggregateRecord,
  DeveloperProfileRecord,
  ManagedActionRecord,
  RegisteredProgramRecord,
  SponsorWalletRecord,
  UserSessionAggregateRecord,
  DeveloperSetupRepository
} from "./repository";
import { createPrismaDeveloperSetupRepository } from "./repository";

const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DASHBOARD_ZKLOGIN_MAX_EPOCH = 2;
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
  allowTestIdentityCompletion?: boolean;
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
    const response = await fetch(url);
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
        maxEpoch: input.maxEpoch,
        jwtRandomness: input.jwtRandomness,
        salt: input.salt,
        keyClaimName: "sub"
      })
    });
    const payload = (await response.json()) as unknown;

    if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw unauthorized("zkLogin prover rejected the Google identity");
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
  private readonly allowTestIdentityCompletion: boolean;

  constructor(options: DeveloperSetupServiceOptions) {
    this.repository = options.repository ?? createPrismaDeveloperSetupRepository();
    this.encryptionKey = options.encryptionKey;
    this.apiOrigin = options.apiOrigin;
    this.hostedAuthOrigin = options.hostedAuthOrigin;
    this.developerAppOrigin = options.developerAppOrigin;
    this.demoFrontendOrigin = options.demoFrontendOrigin;
    this.googleClientId = options.googleClientId ?? "development-google-client-id";
    this.googleIssuer = options.googleIssuer ?? "https://accounts.google.com";
    this.zkLoginSaltSeed = options.zkLoginSaltSeed ?? "development-celeris-zklogin-salt-seed";
    this.zkLoginMaxEpochWindow = options.zkLoginMaxEpochWindow ?? DEFAULT_DASHBOARD_ZKLOGIN_MAX_EPOCH;
    this.googleOAuthClient =
      options.googleOAuthClient ??
      new RuntimeGoogleOAuthClient({
        clientId: this.googleClientId,
        clientSecret: options.googleClientSecret ?? "development-google-client-secret",
        redirectUri: options.googleRedirectUri ?? new URL("/v1/auth/google/callback", options.apiOrigin).toString(),
        issuer: this.googleIssuer
      });
    this.zkLoginProver =
      options.zkLoginProver ?? new RuntimeZkLoginProver(options.zkLoginProverOrigin ?? "http://localhost:9000");
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

  private async resolveUserIdentity(identity: VerifiedGoogleIdentity) {
    const existing = await this.repository.findUserIdentityByIssuerSubject(identity.issuer, identity.subject);

    if (existing) {
      return existing;
    }

    const salt = deriveZkLoginSalt(this.zkLoginSaltSeed, identity.issuer, identity.subject);

    return this.repository.createUserIdentity({
      issuer: identity.issuer,
      subject: identity.subject,
      email: identity.email,
      displayName: identity.displayName,
      salt,
      walletAddress: deriveZkLoginWalletAddress({
        issuer: identity.issuer,
        subject: identity.subject,
        aud: identity.audience,
        salt
      })
    });
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

  private async requireApp(developerProfileId: string, appId: string) {
    const app = await this.repository.findAppByIdForDeveloperProfile(developerProfileId, appId);

    if (!app) {
      throw notFound("App not found");
    }

    return app;
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
  >
) {
  if (!runtimeDeveloperSetupService) {
    runtimeDeveloperSetupService = createDeveloperSetupService(options);
  }

  return runtimeDeveloperSetupService;
}
