import {
  CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER,
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  appBalanceResponseSchema,
  appCatalogResponseSchema,
  actionSponsorshipResponseSchema,
  authLoginRequestResponseSchema,
  authSessionResponseSchema,
  appTransactionsResponseSchema,
  buildHelloCelerisSayHelloTransaction,
  checkoutSessionResponseSchema,
  completeSayHelloResponseSchema,
  completeCheckoutSessionResponseSchema,
  type AppBalance,
  type AppCatalog,
  type AppTransactionRecord,
  type AuthLoginRequest,
  type AuthSession,
  type CheckoutSession
} from "@celeris/shared";
import { fromBase64, toBase64 } from "@mysten/bcs";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { TransactionDataBuilder, type Transaction } from "@mysten/sui/transactions";
import { generateNonce, generateRandomness, getExtendedEphemeralPublicKey, getZkLoginSignature } from "@mysten/sui/zklogin";

export interface CelerisBrowserClientConfig {
  appId: string;
  redirectUri: string;
  suiRpcOrigin?: string;
}

export const CELERIS_BROWSER_SDK_API_ORIGIN = "https://api.celeris.pro";
export const CELERIS_BROWSER_SDK_HOSTED_AUTH_ORIGIN = "https://auth.celeris.pro";

export interface StartLoginOptions {
  redirect?: boolean;
}

export interface StartCheckoutOptions {
  usdAmount: number;
  redirect?: boolean;
  successRedirectUrl?: string;
  cancelRedirectUrl?: string;
}

export interface ExecuteActionOptions {
  actionType: string;
  transaction: Transaction;
  metadata?: Record<string, unknown>;
}

type InternalExecuteActionOptions = ExecuteActionOptions & {
  sessionOverride?: AuthSession;
};

export class CelerisBrowserSdkError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "CelerisBrowserSdkError";
  }
}

export class CelerisAuthError extends CelerisBrowserSdkError {
  constructor(message: string, status?: number) {
    super(message, "auth_failure", status);
    this.name = "CelerisAuthError";
  }
}

export class CelerisInsufficientCreditsError extends CelerisBrowserSdkError {
  constructor(message = "Insufficient credits", status?: number) {
    super(message, "insufficient_credits", status);
    this.name = "CelerisInsufficientCreditsError";
  }
}

export class CelerisSponsorshipError extends CelerisBrowserSdkError {
  constructor(message: string, status?: number) {
    super(message, "sponsorship_failure", status);
    this.name = "CelerisSponsorshipError";
  }
}

export class CelerisTransactionVerificationError extends CelerisBrowserSdkError {
  constructor(message: string, status?: number) {
    super(message, "transaction_verification_failure", status);
    this.name = "CelerisTransactionVerificationError";
  }
}

const sessionStorageKeyPrefix = "celeris.auth.session";
const ephemeralStorageKeyPrefix = "celeris.zklogin.ephemeral";

function normalizeConfig(config: CelerisBrowserClientConfig): CelerisBrowserClientConfig {
  const normalized = {
    appId: config.appId.trim(),
    redirectUri: new URL(config.redirectUri).toString(),
    suiRpcOrigin: config.suiRpcOrigin ? new URL(config.suiRpcOrigin).toString() : undefined
  };

  if (!normalized.appId) {
    throw new CelerisBrowserSdkError("Celeris appId is required", "invalid_config");
  }

  return normalized;
}

function getSessionStorage() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    throw new Error("Celeris browser auth requires sessionStorage");
  }

  return window.sessionStorage;
}

function createStorageKey(prefix: string, appId: string) {
  return `${prefix}.${appId}`;
}

function createRandomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Celeris browser auth requires Web Crypto");
  }

  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function serializeTransactionKindBytes(transaction: Transaction, suiRpcOrigin?: string) {
  if (suiRpcOrigin) {
    const client = new SuiClient({ url: suiRpcOrigin });
    return toBase64(await transaction.build({ client, onlyTransactionKind: true }));
  }

  try {
    return toBase64(TransactionDataBuilder.restore(transaction.getData() as never).build({ onlyTransactionKind: true }));
  } catch {
    return toBase64(new TextEncoder().encode(JSON.stringify(transaction.getData())));
  }
}

function assertSignatureReadyZkLoginProofInputs(proofInputs: Record<string, unknown>) {
  const missingFields: string[] = [];
  const proofPoints = proofInputs.proofPoints as Record<string, unknown> | undefined;
  const issBase64Details = proofInputs.issBase64Details as Record<string, unknown> | undefined;

  if (!proofPoints || !Array.isArray(proofPoints.a) || !Array.isArray(proofPoints.b) || !Array.isArray(proofPoints.c)) {
    missingFields.push("proofPoints");
  }

  if (!issBase64Details || typeof issBase64Details.value !== "string" || typeof issBase64Details.indexMod4 !== "number") {
    missingFields.push("issBase64Details");
  }

  if (typeof proofInputs.headerBase64 !== "string") {
    missingFields.push("headerBase64");
  }

  if (typeof proofInputs.addressSeed !== "string") {
    missingFields.push("addressSeed");
  }

  if (missingFields.length > 0) {
    throw new CelerisTransactionVerificationError(
      `Celeris zkLogin proof inputs are missing required field(s): ${missingFields.join(", ")}`
    );
  }
}

async function resolveMaxEpoch(suiRpcOrigin?: string) {
  if (!suiRpcOrigin) {
    return 2;
  }

  const response = await fetch(suiRpcOrigin, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getLatestSuiSystemState",
      params: []
    })
  });
  const payload = (await response.json()) as { result?: { epoch?: string } };
  const epoch = Number(payload.result?.epoch);

  if (!response.ok || !Number.isFinite(epoch)) {
    throw new Error("Failed to resolve Sui epoch for zkLogin");
  }

  return epoch + 2;
}

function createRequestError(message: string, status: number, context?: "auth" | "sponsorship" | "verification") {
  if (status === 401 || status === 403 || context === "auth") {
    return new CelerisAuthError(message, status);
  }

  if (/insufficient credits/i.test(message)) {
    return new CelerisInsufficientCreditsError(message, status);
  }

  if (context === "verification") {
    return new CelerisTransactionVerificationError(message, status);
  }

  if (context === "sponsorship") {
    return new CelerisSponsorshipError(message, status);
  }

  return new CelerisBrowserSdkError(message, "request_failed", status);
}

async function requestJson<T>(
  url: URL,
  init: RequestInit,
  parser: { parse: (value: unknown) => T },
  context?: "auth" | "sponsorship" | "verification"
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw createRequestError(message, response.status, context);
  }

  return parser.parse(payload);
}

export function createCelerisBrowserClient(config: CelerisBrowserClientConfig) {
  config = normalizeConfig(config);
  const sessionStorageKey = createStorageKey(sessionStorageKeyPrefix, config.appId);
  const ephemeralStorageKey = createStorageKey(ephemeralStorageKeyPrefix, config.appId);

  function storeSession(session: AuthSession) {
    getSessionStorage().setItem(sessionStorageKey, JSON.stringify(session));
    return session;
  }

  function readStoredSession() {
    const stored = getSessionStorage().getItem(sessionStorageKey);
    return stored ? authSessionResponseSchema.shape.session.parse(JSON.parse(stored)) : null;
  }

  function readEphemeralSecretKey() {
    const stored = getSessionStorage().getItem(ephemeralStorageKey);
    if (!stored) {
      throw new Error("Celeris zkLogin ephemeral key material is missing");
    }
    const parsed = JSON.parse(stored) as { ephemeralSecretKey?: unknown };
    if (typeof parsed.ephemeralSecretKey !== "string") {
      throw new Error("Celeris zkLogin ephemeral key material is invalid");
    }
    return parsed.ephemeralSecretKey;
  }

  async function requireStoredSession() {
    const session = await client.auth.getSession();

    if (!session) {
      throw new CelerisAuthError("Celeris user session required");
    }

    return session;
  }

  async function requestAuthenticatedJson<T>(
    url: URL,
    init: RequestInit,
    parser: { parse: (value: unknown) => T },
    context?: "auth" | "sponsorship" | "verification"
  ) {
    const session = await requireStoredSession();
    return requestJson(
      url,
      {
        ...init,
        headers: {
          authorization: `Bearer ${session.token}`,
          ...(init.headers ?? {})
        }
      },
      parser,
      context
    );
  }

  async function submitSponsoredTransaction(session: AuthSession, transactionBytes: string, sponsorSignature: string) {
    if (!config.suiRpcOrigin) {
      return {
        digest: `local-${createRandomToken(16)}`
      };
    }

    if (!session.zkLogin?.proofInputs || session.zkLogin.maxEpoch === null) {
      throw new CelerisTransactionVerificationError("Celeris zkLogin session material is required to submit sponsored transactions");
    }

    assertSignatureReadyZkLoginProofInputs(session.zkLogin.proofInputs);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(readEphemeralSecretKey());
    const { signature: userSignature } = await ephemeralKeypair.signTransaction(fromBase64(transactionBytes));
    const zkLoginSignature = getZkLoginSignature({
      inputs: session.zkLogin.proofInputs as never,
      maxEpoch: session.zkLogin.maxEpoch,
      userSignature
    });
    const client = new SuiClient({
      url: config.suiRpcOrigin
    });

    return client.executeTransactionBlock({
      transactionBlock: fromBase64(transactionBytes),
      signature: [zkLoginSignature, sponsorSignature],
      options: {
        showEffects: true
      }
    });
  }

  const client = {
    config,
    auth: {
      startLogin: async (options: StartLoginOptions = {}): Promise<AuthLoginRequest> => {
        const ephemeralKeypair = Ed25519Keypair.generate();
        const maxEpoch = await resolveMaxEpoch(config.suiRpcOrigin);
        const jwtRandomness = generateRandomness();
        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeypair.getPublicKey());
        const nonce = generateNonce(ephemeralKeypair.getPublicKey(), maxEpoch, jwtRandomness);
        const ephemeral = {
          nonce,
          extendedEphemeralPublicKey,
          maxEpoch,
          jwtRandomness,
          ephemeralSecretKey: ephemeralKeypair.getSecretKey(),
          createdAt: new Date().toISOString()
        };

        getSessionStorage().setItem(ephemeralStorageKey, JSON.stringify(ephemeral));

        const response = await requestJson(
          new URL("/v1/auth/login-requests", CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "POST",
            body: JSON.stringify({
              clientKind: CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER,
              clientId: config.appId,
              appId: config.appId,
              redirectUri: config.redirectUri,
              zkLogin: {
                nonce,
                extendedEphemeralPublicKey,
                maxEpoch,
                jwtRandomness
              }
            })
          },
          authLoginRequestResponseSchema,
          "auth"
        );

        if (options.redirect !== false) {
          window.location.href = response.loginRequest.authUrl;
        }

        return response.loginRequest;
      },
      handleRedirectCallback: async (callbackUrl = window.location.href): Promise<AuthSession> => {
        const params = new URL(callbackUrl).searchParams;
        const code = params.get("code");
        const state = params.get("state");

        if (!code || !state) {
          throw new Error("Missing Celeris auth callback parameters");
        }

        const response = await requestJson(
          new URL("/v1/auth/token", CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "POST",
            body: JSON.stringify({
              code,
              state
            })
          },
          authSessionResponseSchema,
          "auth"
        );

        return storeSession(response.session);
      },
      getSession: async (): Promise<AuthSession | null> => {
        const parsed = readStoredSession();

        if (!parsed) {
          return null;
        }
        const response = await fetch(new URL("/v1/me", CELERIS_BROWSER_SDK_API_ORIGIN), {
          headers: {
            authorization: `Bearer ${parsed.token}`
          }
        });

        if (response.status === 401) {
          getSessionStorage().removeItem(sessionStorageKey);
          return null;
        }

        const payload = authSessionResponseSchema.parse(await response.json());
        const refreshedSession = payload.session;
        const mergedSession: AuthSession =
          parsed.zkLogin && refreshedSession.zkLogin
            ? {
                ...refreshedSession,
                zkLogin: {
                  nonce: refreshedSession.zkLogin.nonce ?? parsed.zkLogin.nonce,
                  extendedEphemeralPublicKey:
                    refreshedSession.zkLogin.extendedEphemeralPublicKey ?? parsed.zkLogin.extendedEphemeralPublicKey,
                  maxEpoch: refreshedSession.zkLogin.maxEpoch ?? parsed.zkLogin.maxEpoch,
                  proofInputs: refreshedSession.zkLogin.proofInputs ?? parsed.zkLogin.proofInputs
                }
              }
            : refreshedSession;

        return storeSession(mergedSession);
      },
      signOut: async (): Promise<void> => {
        const parsed = readStoredSession();

        if (parsed) {
          await fetch(new URL("/v1/auth/logout", CELERIS_BROWSER_SDK_API_ORIGIN), {
            method: "POST",
            headers: {
              authorization: `Bearer ${parsed.token}`
            }
          });
        }

        getSessionStorage().removeItem(sessionStorageKey);
        getSessionStorage().removeItem(ephemeralStorageKey);
      }
    },
    apps: {
      getCatalog: async (): Promise<AppCatalog> => {
        const response = await requestJson(
          new URL(`/v1/apps/${config.appId}/catalog`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "GET"
          },
          appCatalogResponseSchema
        );
        return response.catalog;
      }
    },
    credits: {
      getBalance: async (): Promise<AppBalance> => {
        const response = await requestAuthenticatedJson(
          new URL(`/v1/apps/${config.appId}/balance`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "GET"
          },
          appBalanceResponseSchema
        );
        return response.balance;
      },
      startCheckout: async (options: StartCheckoutOptions): Promise<CheckoutSession> => {
        const response = await requestAuthenticatedJson(
          new URL(`/v1/apps/${config.appId}/checkout-sessions`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "POST",
            body: JSON.stringify({
              usdAmount: options.usdAmount,
              successRedirectUrl: options.successRedirectUrl,
              cancelRedirectUrl: options.cancelRedirectUrl
            })
          },
          checkoutSessionResponseSchema
        );

        if (options.redirect !== false) {
          window.location.href = response.checkoutSession.checkoutUrl;
        }

        return response.checkoutSession;
      },
      completeCheckout: async (checkoutSessionId: string): Promise<{ checkoutSession: CheckoutSession; balance: AppBalance }> => {
        return requestAuthenticatedJson(
          new URL(`/v1/apps/${config.appId}/checkout-sessions/${checkoutSessionId}/complete`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "POST"
          },
          completeCheckoutSessionResponseSchema
        );
      }
    },
    actions: {
      execute: async (input: InternalExecuteActionOptions): Promise<{
        reservationId: string;
        digest: string;
        balance: AppBalance;
        transaction: AppTransactionRecord | null;
        metadata: Record<string, unknown> | null;
      }> => {
        const session = input.sessionOverride ?? (await requireStoredSession());
        const transactionKind = input.transaction.getData();
        const transactionKindBytes = await serializeTransactionKindBytes(input.transaction, config.suiRpcOrigin);
        const execution = await requestAuthenticatedJson(
          new URL(`/v1/apps/${config.appId}/actions/${encodeURIComponent(input.actionType)}/execute`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "POST",
            body: JSON.stringify({
              transactionKindBytes,
              transactionKind,
              metadata: input.metadata
            })
          },
          actionSponsorshipResponseSchema,
          "sponsorship"
        );

        try {
          const submitted = await submitSponsoredTransaction(
            session,
            execution.sponsorship.transactionBytes,
            execution.sponsorship.sponsorSignature
          );
          const completion = await requestAuthenticatedJson(
            new URL(`/v1/apps/${config.appId}/actions/${encodeURIComponent(input.actionType)}/complete`, CELERIS_BROWSER_SDK_API_ORIGIN),
            {
              method: "POST",
              body: JSON.stringify({
                reservationId: execution.sponsorship.reservationId,
                outcome: "submitted",
                digest: submitted.digest
              })
            },
            completeSayHelloResponseSchema,
            "verification"
          );

          return {
            reservationId: execution.sponsorship.reservationId,
            digest: submitted.digest,
            balance: completion.balance,
            transaction: completion.transaction,
            metadata: execution.sponsorship.metadata
          };
        } catch (error) {
          await requestAuthenticatedJson(
            new URL(`/v1/apps/${config.appId}/actions/${encodeURIComponent(input.actionType)}/complete`, CELERIS_BROWSER_SDK_API_ORIGIN),
            {
              method: "POST",
              body: JSON.stringify({
                reservationId: execution.sponsorship.reservationId,
                outcome: "failed"
              })
            },
            completeSayHelloResponseSchema,
            "verification"
          ).catch(() => null);
          throw error;
        }
      },
      sayHello: async (input: { appStateObjectId: string; username: string }): Promise<{
        reservationId: string;
        digest: string;
        message: string;
        balance: AppBalance;
        transaction: AppTransactionRecord | null;
      }> => {
        const session = await requireStoredSession();
        const catalog = await client.apps.getCatalog();

        if (!catalog.registeredProgram) {
          throw new CelerisSponsorshipError("Celeris app is missing registered Sui program metadata");
        }

        const built = buildHelloCelerisSayHelloTransaction({
          packageId: catalog.registeredProgram.packageId,
          appStateObjectId: input.appStateObjectId,
          username: input.username
        });
        const result = await client.actions.execute({
          actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
          transaction: built.transaction,
          sessionOverride: session,
          metadata: {
            username: built.normalizedUsername,
            message: built.message
          }
        });

        return {
          ...result,
          message: typeof result.metadata?.message === "string" ? result.metadata.message : built.message
        };
      }
    },
    transactions: {
      list: async (): Promise<AppTransactionRecord[]> => {
        const response = await requestJson(
          new URL(`/v1/apps/${config.appId}/transactions`, CELERIS_BROWSER_SDK_API_ORIGIN),
          {
            method: "GET"
          },
          appTransactionsResponseSchema
        );
        return response.transactions;
      }
    }
  };

  return client;
}
