import {
  CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER,
  authLoginRequestResponseSchema,
  authSessionResponseSchema,
  type AuthLoginRequest,
  type AuthSession
} from "@celeris/shared";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateNonce, generateRandomness, getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";

export interface CelerisBrowserClientConfig {
  appId: string;
  apiOrigin: string;
  hostedAuthOrigin: string;
  redirectUri: string;
  suiRpcOrigin?: string;
}

export interface StartLoginOptions {
  redirect?: boolean;
}

function notImplemented(methodName: string): never {
  throw new Error(`${methodName} is not implemented in this slice`);
}

const sessionStorageKeyPrefix = "celeris.auth.session";
const ephemeralStorageKeyPrefix = "celeris.zklogin.ephemeral";

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
      method: "sui_getLatestSuiSystemState",
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

async function requestJson<T>(url: URL, init: RequestInit, parser: { parse: (value: unknown) => T }) {
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

    throw new Error(message);
  }

  return parser.parse(payload);
}

export function createCelerisBrowserClient(config: CelerisBrowserClientConfig) {
  const sessionStorageKey = createStorageKey(sessionStorageKeyPrefix, config.appId);
  const ephemeralStorageKey = createStorageKey(ephemeralStorageKeyPrefix, config.appId);

  function storeSession(session: AuthSession) {
    getSessionStorage().setItem(sessionStorageKey, JSON.stringify(session));
    return session;
  }

  return {
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
          new URL("/v1/auth/login-requests", config.apiOrigin),
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
          authLoginRequestResponseSchema
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
          new URL("/v1/auth/token", config.apiOrigin),
          {
            method: "POST",
            body: JSON.stringify({
              code,
              state
            })
          },
          authSessionResponseSchema
        );

        return storeSession(response.session);
      },
      getSession: async (): Promise<AuthSession | null> => {
        const stored = getSessionStorage().getItem(sessionStorageKey);

        if (!stored) {
          return null;
        }

        const parsed = authSessionResponseSchema.shape.session.parse(JSON.parse(stored));
        const response = await fetch(new URL("/v1/me", config.apiOrigin), {
          headers: {
            authorization: `Bearer ${parsed.token}`
          }
        });

        if (response.status === 401) {
          getSessionStorage().removeItem(sessionStorageKey);
          return null;
        }

        const payload = authSessionResponseSchema.parse(await response.json());
        return storeSession(payload.session);
      },
      signOut: async (): Promise<void> => {
        const stored = getSessionStorage().getItem(sessionStorageKey);
        const parsed = stored ? authSessionResponseSchema.shape.session.parse(JSON.parse(stored)) : null;

        if (parsed) {
          await fetch(new URL("/v1/auth/logout", config.apiOrigin), {
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
      getCatalog: async () => notImplemented("apps.getCatalog")
    },
    credits: {
      getBalance: async () => notImplemented("credits.getBalance"),
      startCheckout: async () => notImplemented("credits.startCheckout")
    },
    actions: {
      sayHello: async (_input: { username: string }) => notImplemented("actions.sayHello")
    },
    transactions: {
      list: async () => notImplemented("transactions.list")
    }
  };
}
