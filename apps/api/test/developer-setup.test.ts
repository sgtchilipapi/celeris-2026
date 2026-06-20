import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryDeveloperSetupRepository } from "../src/features/developer/repository";
import type { GoogleOAuthClient, SuiSponsorAdapter, VerifiedGoogleIdentity, ZkLoginProver } from "../src/features/developer/service";
import { createDeveloperSetupService } from "../src/features/developer/service";
import { unauthorized } from "../src/lib/http-error";
import { buildHelloCelerisSayHelloTransaction } from "@celeris/shared";
import { toBase64 } from "@mysten/bcs";
import { Transaction, TransactionDataBuilder } from "@mysten/sui/transactions";

const validPackageId = "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011";
const validAppStateObjectId = "0x6f5f67b135cb76aab0b0d3cf90a227ca31da93c1df2c0d0e42f7324de8f0fe21";
const originalEnv = {
  API_ORIGIN: process.env.API_ORIGIN,
  CELERIS_APP_ENCRYPTION_KEY: process.env.CELERIS_APP_ENCRYPTION_KEY,
  CELERIS_DEVELOPER_APP_ORIGIN: process.env.CELERIS_DEVELOPER_APP_ORIGIN,
  CELERIS_DEMO_FRONTEND_ORIGIN: process.env.CELERIS_DEMO_FRONTEND_ORIGIN,
  CELERIS_HOSTED_AUTH_ORIGIN: process.env.CELERIS_HOSTED_AUTH_ORIGIN,
  CELERIS_GOOGLE_CLIENT_ID: process.env.CELERIS_GOOGLE_CLIENT_ID,
  CELERIS_GOOGLE_CLIENT_SECRET: process.env.CELERIS_GOOGLE_CLIENT_SECRET,
  CELERIS_GOOGLE_REDIRECT_URI: process.env.CELERIS_GOOGLE_REDIRECT_URI,
  CELERIS_GOOGLE_ISSUER: process.env.CELERIS_GOOGLE_ISSUER,
  CELERIS_ZKLOGIN_SALT_SEED: process.env.CELERIS_ZKLOGIN_SALT_SEED,
  CELERIS_ZKLOGIN_PROVER_ORIGIN: process.env.CELERIS_ZKLOGIN_PROVER_ORIGIN,
  CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW: process.env.CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW,
  CELERIS_SUI_RPC_ORIGIN: process.env.CELERIS_SUI_RPC_ORIGIN
};

function setRequiredApiEnv() {
  process.env.API_ORIGIN = "http://localhost:4100";
  process.env.CELERIS_APP_ENCRYPTION_KEY = "test-encryption-key-0123456789";
  process.env.CELERIS_DEVELOPER_APP_ORIGIN = "http://localhost:3102";
  process.env.CELERIS_DEMO_FRONTEND_ORIGIN = "http://localhost:3103";
  process.env.CELERIS_HOSTED_AUTH_ORIGIN = "http://localhost:3101";
  process.env.CELERIS_GOOGLE_CLIENT_ID = "google-client-id";
  process.env.CELERIS_GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.CELERIS_GOOGLE_REDIRECT_URI = "http://localhost:4100/v1/auth/google/callback";
  process.env.CELERIS_GOOGLE_ISSUER = "https://accounts.google.com";
  process.env.CELERIS_ZKLOGIN_SALT_SEED = "test-zklogin-salt-seed-0123456789";
  process.env.CELERIS_ZKLOGIN_PROVER_ORIGIN = "http://localhost:9000";
  process.env.CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW = "2";
  process.env.CELERIS_SUI_RPC_ORIGIN = "https://fullnode.testnet.sui.io:443";
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createMockGoogleOAuthClient(): GoogleOAuthClient {
  return {
    createAuthorizationUrl(input) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("state", input.state);
      if (input.nonce) {
        url.searchParams.set("nonce", input.nonce);
      }
      return url.toString();
    },
    async exchangeCodeForIdToken(code) {
      if (code === "invalid-token") {
        return "invalid-token";
      }
      return `id-token:${code}`;
    },
    async verifyIdToken(idToken, expectedAudience): Promise<VerifiedGoogleIdentity> {
      if (idToken === "invalid-token") {
        throw unauthorized("Invalid Google ID token");
      }

      const [subject = "dev", nonce = null] = idToken.replace("id-token:", "").split(":");
      return {
        issuer: "https://accounts.google.com",
        subject,
        email: `${subject}@example.com`,
        displayName: "Google User",
        audience: expectedAudience,
        nonce
      };
    }
  };
}

const mockZkLoginProver: ZkLoginProver = {
  async requestProof(input) {
    return {
      proof: "mock-proof",
      publicSignals: ["mock-signal"],
      maxEpoch: input.maxEpoch,
      salt: input.salt
    };
  }
};

const mockSuiSponsorAdapter: SuiSponsorAdapter = {
  async getSponsorWalletBalance() {
    return {
      totalBalanceMist: "1230000000"
    };
  },
  async createSponsoredAction(input) {
    return {
      transactionBytes: "mock-transaction-bytes",
      sponsorSignature: "mock-sponsor-signature",
      sponsorAddress: input.sponsorWallet.address,
      gasCoin: {
        objectId: "0x2",
        version: "1",
        digest: "gas-digest"
      }
    };
  },
  async verifyTransaction(input) {
    if (input.digest === "bad-digest") {
      throw unauthorized("Invalid digest");
    }
    return {
      confirmedAt: new Date("2026-06-17T00:00:00.000Z")
    };
  }
};

function createTestHarness(options: { suiSponsorAdapter?: SuiSponsorAdapter } = {}) {
  const service = createDeveloperSetupService({
    repository: createInMemoryDeveloperSetupRepository(),
    encryptionKey: "test-encryption-key-0123456789",
    apiOrigin: "http://localhost:4100",
    hostedAuthOrigin: "http://localhost:3101",
    developerAppOrigin: "http://localhost:3102",
    demoFrontendOrigin: "http://localhost:3103",
    googleClientId: "google-client-id",
    googleClientSecret: "google-client-secret",
    googleRedirectUri: "http://localhost:4100/v1/auth/google/callback",
    googleIssuer: "https://accounts.google.com",
    zkLoginSaltSeed: "test-zklogin-salt-seed-0123456789",
    zkLoginProverOrigin: "http://localhost:9000",
    googleOAuthClient: createMockGoogleOAuthClient(),
    zkLoginProver: mockZkLoginProver,
    suiSponsorAdapter: options.suiSponsorAdapter ?? mockSuiSponsorAdapter
  });

  return createApp({ service });
}

function toTransactionKindBytes(transaction: Transaction) {
  return toBase64(TransactionDataBuilder.restore(transaction.getData() as never).build({ onlyTransactionKind: true }));
}

function buildMoveCallTransactionKindBytes(packageId: string, moduleName = "hello_celeris", functionName = "say_hello") {
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    arguments: []
  });
  return toTransactionKindBytes(transaction);
}

async function requestJson(
  app: ReturnType<typeof createTestHarness>,
  options: {
    method: "GET" | "POST" | "PUT";
    url: string;
    body?: Record<string, unknown>;
    token?: string;
    headers?: Record<string, string>;
  }
) {
  const appHandler = app as unknown as {
    handle: (request: unknown, response: unknown, next: (error?: unknown) => void) => void;
  };
  const request = createRequest({
    method: options.method,
    url: options.url,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {})
    },
    body: options.body as never
  });
  const response = createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise<void>((resolve, reject) => {
    response.on("end", resolve);
    appHandler.handle(request, response, reject);
  });

  return {
    statusCode: response.statusCode,
    redirectUrl: response._getRedirectUrl(),
    json: response._isJSON() ? response._getJSONData() : null
  };
}

async function authenticateDashboard(app: ReturnType<typeof createTestHarness>, email = "dev@example.com") {
  const subject = email.split("@")[0];
  const loginRequest = await requestJson(app, {
    method: "POST",
    url: "/v1/auth/login-requests",
    body: {
      clientKind: "developer_dashboard",
      clientId: "celeris-dashboard",
      redirectUri: "http://localhost:3102/auth/callback"
    }
  });

  const googleStart = await requestJson(app, {
    method: "GET",
    url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
  });
  const googleUrl = new URL(googleStart.redirectUrl);

  const googleCallback = await requestJson(app, {
    method: "GET",
    url: `/v1/auth/google/callback?code=${subject}:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
  });
  const redirectUrl = new URL(googleCallback.redirectUrl);
  const token = await requestJson(app, {
    method: "POST",
    url: "/v1/auth/token",
    body: {
      code: redirectUrl.searchParams.get("code"),
      state: redirectUrl.searchParams.get("state")
    }
  });

  return token.json.session.token as string;
}

async function authenticateConsumer(app: ReturnType<typeof createTestHarness>, appId: string, subject = "user") {
  const loginRequest = await requestJson(app, {
    method: "POST",
    url: "/v1/auth/login-requests",
    body: {
      clientKind: "app_consumer",
      clientId: appId,
      appId,
      redirectUri: "http://localhost:3103/auth/callback"
    }
  });
  const googleStart = await requestJson(app, {
    method: "GET",
    url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
  });
  const googleUrl = new URL(googleStart.redirectUrl);
  const googleCallback = await requestJson(app, {
    method: "GET",
    url: `/v1/auth/google/callback?code=${subject}:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
  });
  const redirectUrl = new URL(googleCallback.redirectUrl);
  const token = await requestJson(app, {
    method: "POST",
    url: "/v1/auth/token",
    body: {
      code: redirectUrl.searchParams.get("code"),
      state: redirectUrl.searchParams.get("state")
    }
  });

  return token.json.session.token as string;
}

async function createConfiguredSponsoredApp(app: ReturnType<typeof createTestHarness>, options: { fundCredits?: boolean; actionType?: string } = {}) {
  const actionType = options.actionType ?? "say_hello";
  const developerToken = await authenticateDashboard(app, `${actionType}-owner@example.com`);
  const createAppResponse = await requestJson(app, {
    method: "POST",
    url: "/v1/developer/apps",
    token: developerToken,
    body: {
      name: `${actionType} Sponsored App`
    }
  });
  const appId = createAppResponse.json.app.appId as string;
  await requestJson(app, {
    method: "POST",
    url: `/v1/developer/apps/${appId}/sponsor-wallet`,
    token: developerToken
  });
  await requestJson(app, {
    method: "PUT",
    url: `/v1/developer/apps/${appId}/program`,
    token: developerToken,
    body: {
      packageId: validPackageId
    }
  });
  await requestJson(app, {
    method: "PUT",
    url: `/v1/developer/apps/${appId}/actions/${actionType}`,
    token: developerToken,
    body: {
      priceCredits: 7,
      isEnabled: true
    }
  });
  const consumerToken = await authenticateConsumer(app, appId, `${actionType}-user`);

  if (options.fundCredits) {
    const checkout = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions`,
      token: consumerToken,
      body: {
        usdAmount: 1
      }
    });
    await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions/${checkout.json.checkoutSession.checkoutSessionId}/complete`,
      token: consumerToken
    });
  }

  return {
    appId,
    consumerToken
  };
}

describe("developer setup routes", () => {
  let app: ReturnType<typeof createTestHarness>;

  beforeEach(() => {
    setRequiredApiEnv();
    app = createTestHarness();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  it("supports shared-auth dashboard sign-in plus app create/list/get", async () => {
    const token = await authenticateDashboard(app);

    const me = await requestJson(app, {
      method: "GET",
      url: "/v1/developer/me",
      token
    });

    expect(me.statusCode).toBe(200);
    expect(me.json.developerProfile.email).toBe("dev@example.com");

    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token,
      body: {
        name: "Hello Celeris Demo"
      }
    });

    expect(createAppResponse.statusCode).toBe(201);
    expect(createAppResponse.json.app.name).toBe("Hello Celeris Demo");
    expect(createAppResponse.json.app.sdkConfig).toMatchObject({
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      demoOrigin: "http://localhost:3103"
    });
    expect(createAppResponse.json.app.allowedOrigins).toEqual(["http://localhost:3103"]);

    const listApps = await requestJson(app, {
      method: "GET",
      url: "/v1/developer/apps",
      token
    });

    expect(listApps.statusCode).toBe(200);
    expect(listApps.json.apps).toHaveLength(1);

    const getApp = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${createAppResponse.json.app.appId}`,
      token
    });

    expect(getApp.statusCode).toBe(200);
    expect(getApp.json.app.appId).toBe(createAppResponse.json.app.appId);
  });

  it("supports app-scoped consumer auth without creating a developer profile", async () => {
    const developerToken = await authenticateDashboard(app, "owner@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Consumer Auth App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;

    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "http://localhost:3103/auth/callback"
      }
    });

    expect(loginRequest.statusCode).toBe(201);
    expect(loginRequest.json.loginRequest).toMatchObject({
      clientKind: "app_consumer",
      clientId: appId,
      appId
    });

    const googleStart = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
    });
    const googleUrl = new URL(googleStart.redirectUrl);
    const googleCallback = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/callback?code=user:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
    });
    const redirectUrl = new URL(googleCallback.redirectUrl);
    const token = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/token",
      body: {
        code: redirectUrl.searchParams.get("code"),
        state: redirectUrl.searchParams.get("state")
      }
    });

    expect(token.statusCode).toBe(200);
    expect(token.json.session).toMatchObject({
      clientKind: "app_consumer",
      clientId: appId,
      appId,
      developerProfile: null
    });

    const me = await requestJson(app, {
      method: "GET",
      url: "/v1/me",
      token: token.json.session.token
    });

    expect(me.statusCode).toBe(200);
    expect(me.json.session.user.walletAddress).toBe(token.json.session.user.walletAddress);
    expect(me.json.session.zkLogin.proofInputs).toMatchObject({
      proof: "mock-proof"
    });
  });

  it("supports catalog, checkout completion, ledger-derived balance, and idempotent repeat completion", async () => {
    const developerToken = await authenticateDashboard(app, "credits-owner@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Credits App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;
    await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/actions/say_hello`,
      token: developerToken,
      body: {
        priceCredits: 7,
        isEnabled: true
      }
    });
    await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/credits-pricing`,
      token: developerToken,
      body: {
        creditsPerUsd: 500
      }
    });
    const consumerToken = await authenticateConsumer(app, appId);

    const catalog = await requestJson(app, {
      method: "GET",
      url: `/v1/apps/${appId}/catalog`
    });

    expect(catalog.statusCode).toBe(200);
    expect(catalog.json.catalog.creditsPricing.creditsPerUsd).toBe(500);
    expect(catalog.json.catalog.actions).toEqual([
      {
        actionType: "say_hello",
        priceCredits: 7,
        isEnabled: true
      }
    ]);
    expect(catalog.json.catalog.registeredProgram).toBeNull();

    const emptyBalance = await requestJson(app, {
      method: "GET",
      url: `/v1/apps/${appId}/balance`,
      token: consumerToken
    });

    expect(emptyBalance.statusCode).toBe(200);
    expect(emptyBalance.json.balance.availableCredits).toBe(0);

    const checkout = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions`,
      token: consumerToken,
      body: {
        usdAmount: 5
      }
    });

    expect(checkout.statusCode).toBe(201);
    expect(checkout.json.checkoutSession).toMatchObject({
      appId,
      usdAmount: 5,
      creditsPerUsd: 500,
      credits: 2500,
      status: "pending"
    });
    expect(checkout.json.checkoutSession.checkoutUrl).toContain("/checkout");

    const complete = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions/${checkout.json.checkoutSession.checkoutSessionId}/complete`,
      token: consumerToken
    });

    expect(complete.statusCode).toBe(200);
    expect(complete.json.checkoutSession.status).toBe("completed");
    expect(complete.json.balance.availableCredits).toBe(2500);

    const repeatComplete = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions/${checkout.json.checkoutSession.checkoutSessionId}/complete`,
      token: consumerToken
    });

    expect(repeatComplete.statusCode).toBe(200);
    expect(repeatComplete.json.balance.availableCredits).toBe(2500);
  });

  it("reserves credits, completes sponsored say_hello, captures credits, and lists the feed newest first", async () => {
    const developerToken = await authenticateDashboard(app, "hello-owner@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Sponsored Hello App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;
    await requestJson(app, {
      method: "POST",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token: developerToken
    });
    await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/program`,
      token: developerToken,
      body: {
        packageId: validPackageId
      }
    });
    await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/actions/say_hello`,
      token: developerToken,
      body: {
        priceCredits: 7,
        isEnabled: true
      }
    });
    const consumerToken = await authenticateConsumer(app, appId, "hello-user");
    const checkout = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions`,
      token: consumerToken,
      body: {
        usdAmount: 1
      }
    });
    await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/checkout-sessions/${checkout.json.checkoutSession.checkoutSessionId}/complete`,
      token: consumerToken
    });
    const transactionKind = buildHelloCelerisSayHelloTransaction({
      packageId: validPackageId,
      appStateObjectId: validAppStateObjectId,
      username: "  Ada  "
    }).transactionKind;
    const transactionKindBytes = buildMoveCallTransactionKindBytes(validPackageId);

    const disallowedOriginExecute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/actions/say_hello/execute`,
      token: consumerToken,
      headers: {
        origin: "https://evil.example"
      },
      body: {
        transactionKindBytes,
        transactionKind,
        metadata: {
          username: "  Ada  "
        }
      }
    });

    expect(disallowedOriginExecute.statusCode).toBe(400);
    expect(disallowedOriginExecute.json.error).toBe("Request origin is not allowed for this app");

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/actions/say_hello/execute`,
      token: consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes,
        transactionKind,
        metadata: {
          username: "  Ada  "
        }
      }
    });

    expect(execute.statusCode).toBe(201);
    expect(execute.json.sponsorship).toMatchObject({
      username: "Ada",
      message: "Ada says Hello Celeris!",
      actionType: "say_hello",
      metadata: {
        username: "Ada",
        message: "Ada says Hello Celeris!"
      },
      transactionBytes: "mock-transaction-bytes",
      sponsorSignature: "mock-sponsor-signature"
    });
    expect(execute.json.balance.availableCredits).toBe(93);

    const complete = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${appId}/actions/say_hello/complete`,
      token: consumerToken,
      body: {
        reservationId: execute.json.sponsorship.reservationId,
        outcome: "submitted",
        digest: "digest_123"
      }
    });

    expect(complete.statusCode).toBe(200);
    expect(complete.json.status).toBe("captured");
    expect(complete.json.balance.availableCredits).toBe(93);
    expect(complete.json.transaction).toMatchObject({
      digest: "digest_123",
      actionType: "say_hello",
      metadata: {
        username: "Ada",
        message: "Ada says Hello Celeris!"
      },
      username: "Ada",
      message: "Ada says Hello Celeris!"
    });

    const feed = await requestJson(app, {
      method: "GET",
      url: `/v1/apps/${appId}/transactions`
    });

    expect(feed.statusCode).toBe(200);
    expect(feed.json.transactions).toHaveLength(1);
    expect(feed.json.transactions[0].digest).toBe("digest_123");
  });

  it("does not sponsor-sign insufficient-credit action requests", async () => {
    const createSponsoredAction = vi.fn(mockSuiSponsorAdapter.createSponsoredAction);
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      createSponsoredAction
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge" });

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: buildMoveCallTransactionKindBytes(validPackageId, "badge", "mint"),
        metadata: {
          badge: "founder"
        }
      }
    });

    expect(execute.statusCode).toBe(400);
    expect(execute.json.error).toBe("Insufficient credits");
    expect(createSponsoredAction).not.toHaveBeenCalled();
  });

  it("rejects malformed and unparseable transaction-kind bytes before sponsorship", async () => {
    const createSponsoredAction = vi.fn(mockSuiSponsorAdapter.createSponsoredAction);
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      createSponsoredAction
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge", fundCredits: true });

    const malformed = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: "not base64!!!"
      }
    });
    const unparseable = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: toBase64(new Uint8Array([1, 2, 3, 4]))
      }
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json.error).toBe("Transaction kind bytes are malformed or unparseable");
    expect(unparseable.statusCode).toBe(400);
    expect(unparseable.json.error).toBe("Transaction kind bytes are malformed or unparseable");
    expect(createSponsoredAction).not.toHaveBeenCalled();
  });

  it("rejects valid transaction-kind bytes outside the registered package policy", async () => {
    const createSponsoredAction = vi.fn(mockSuiSponsorAdapter.createSponsoredAction);
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      createSponsoredAction
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge", fundCredits: true });
    const wrongPackageId = "0x3c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011";

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: buildMoveCallTransactionKindBytes(wrongPackageId, "badge", "mint")
      }
    });

    expect(execute.statusCode).toBe(400);
    expect(execute.json.error).toBe("Transaction kind is outside the app sponsorship policy");
    expect(createSponsoredAction).not.toHaveBeenCalled();
  });

  it("rejects mixed-package transaction-kind bytes", async () => {
    const createSponsoredAction = vi.fn(mockSuiSponsorAdapter.createSponsoredAction);
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      createSponsoredAction
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge", fundCredits: true });
    const wrongPackageId = "0x3c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011";
    const transaction = new Transaction();
    transaction.moveCall({ target: `${validPackageId}::badge::mint`, arguments: [] });
    transaction.moveCall({ target: `${wrongPackageId}::badge::mint`, arguments: [] });

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: toTransactionKindBytes(transaction)
      }
    });

    expect(execute.statusCode).toBe(400);
    expect(execute.json.error).toBe("Transaction kind is outside the app sponsorship policy");
    expect(createSponsoredAction).not.toHaveBeenCalled();
  });

  it("allows valid registered-package transaction-kind bytes to proceed to sponsorship", async () => {
    const createSponsoredAction = vi.fn(mockSuiSponsorAdapter.createSponsoredAction);
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      createSponsoredAction
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge", fundCredits: true });

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: buildMoveCallTransactionKindBytes(validPackageId, "badge", "mint"),
        metadata: {
          badge: "founder"
        }
      }
    });

    expect(execute.statusCode).toBe(201);
    expect(execute.json.sponsorship.actionType).toBe("mint_badge");
    expect(execute.json.balance.availableCredits).toBe(93);
    expect(createSponsoredAction).toHaveBeenCalledTimes(1);
  });

  it("releases reserved credits when sponsor signing fails", async () => {
    const sponsorAdapter: SuiSponsorAdapter = {
      ...mockSuiSponsorAdapter,
      async createSponsoredAction() {
        throw new Error("sponsor unavailable");
      }
    };
    app = createTestHarness({ suiSponsorAdapter: sponsorAdapter });
    const configured = await createConfiguredSponsoredApp(app, { actionType: "mint_badge", fundCredits: true });

    const execute = await requestJson(app, {
      method: "POST",
      url: `/v1/apps/${configured.appId}/actions/mint_badge/execute`,
      token: configured.consumerToken,
      headers: {
        origin: "http://localhost:3103"
      },
      body: {
        transactionKindBytes: buildMoveCallTransactionKindBytes(validPackageId, "badge", "mint")
      }
    });
    const balance = await requestJson(app, {
      method: "GET",
      url: `/v1/apps/${configured.appId}/balance`,
      token: configured.consumerToken
    });

    expect(execute.statusCode).toBe(500);
    expect(balance.statusCode).toBe(200);
    expect(balance.json.balance.availableCredits).toBe(100);
  });

  it("keeps mock identity completion unreachable from the production auth route", async () => {
    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "developer_dashboard",
        clientId: "celeris-dashboard",
        redirectUri: "http://localhost:3102/auth/callback"
      }
    });

    const completion = await requestJson(app, {
      method: "POST",
      url: `/v1/auth/login-requests/${loginRequest.json.loginRequest.loginRequestId}/complete`,
      body: {
        email: "mock@example.com",
        displayName: "Mock User"
      }
    });

    expect(completion.statusCode).toBe(404);
  });

  it("rejects invalid Google callback state and ID tokens", async () => {
    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "developer_dashboard",
        clientId: "celeris-dashboard",
        redirectUri: "http://localhost:3102/auth/callback"
      }
    });
    const googleStart = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
    });
    const googleUrl = new URL(googleStart.redirectUrl);

    const invalidState = await requestJson(app, {
      method: "GET",
      url: "/v1/auth/google/callback?code=dev&state=bad-state"
    });
    const invalidToken = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/callback?code=invalid-token&state=${googleUrl.searchParams.get("state")}`
    });

    expect(invalidState.statusCode).toBe(401);
    expect(invalidToken.statusCode).toBe(401);
  });

  it("serializes runtime zkLogin prover requests with prover-compatible field types", async () => {
    let proverRequestBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      proverRequestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          proofPoints: {
            a: ["1", "2", "1"],
            b: [
              ["1", "2"],
              ["3", "4"],
              ["1", "0"]
            ],
            c: ["1", "2", "1"]
          },
          issBase64Details: {
            value: "mock",
            indexMod4: 0
          },
          headerBase64: "mock"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtimeProverApp = createApp({
      service: createDeveloperSetupService({
        repository: createInMemoryDeveloperSetupRepository(),
        encryptionKey: "test-encryption-key-0123456789",
        apiOrigin: "http://localhost:4100",
        hostedAuthOrigin: "http://localhost:3101",
        developerAppOrigin: "http://localhost:3102",
        demoFrontendOrigin: "http://localhost:3103",
        googleClientId: "google-client-id",
        googleClientSecret: "google-client-secret",
        googleRedirectUri: "http://localhost:4100/v1/auth/google/callback",
        googleIssuer: "https://accounts.google.com",
        zkLoginSaltSeed: "test-zklogin-salt-seed-0123456789",
        zkLoginProverOrigin: "http://localhost:9000",
        googleOAuthClient: createMockGoogleOAuthClient()
      })
    });
    const dashboardToken = await authenticateDashboard(runtimeProverApp);
    const createAppResponse = await requestJson(runtimeProverApp, {
      method: "POST",
      url: "/v1/developer/apps",
      token: dashboardToken,
      body: {
        name: "Runtime Prover App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;
    const loginRequest = await requestJson(runtimeProverApp, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "http://localhost:3103/auth/callback",
        zkLogin: {
          nonce: "consumer-nonce",
          extendedEphemeralPublicKey: "extended-public-key",
          maxEpoch: 9,
          jwtRandomness: "123"
        }
      }
    });
    const googleStart = await requestJson(runtimeProverApp, {
      method: "GET",
      url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
    });
    const googleUrl = new URL(googleStart.redirectUrl);
    const googleCallback = await requestJson(runtimeProverApp, {
      method: "GET",
      url: `/v1/auth/google/callback?code=runtime:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
    });
    const callbackUrl = new URL(googleCallback.redirectUrl);
    const token = await requestJson(runtimeProverApp, {
      method: "POST",
      url: "/v1/auth/token",
      body: {
        code: callbackUrl.searchParams.get("code"),
        state: callbackUrl.searchParams.get("state")
      }
    });

    expect(googleCallback.statusCode).toBe(302);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("http://localhost:9000/v1");
    expect(proverRequestBody).not.toBeNull();
    const sentProverRequestBody = proverRequestBody as unknown as Record<string, unknown>;
    expect(sentProverRequestBody).toMatchObject({
      jwt: "id-token:runtime:consumer-nonce",
      extendedEphemeralPublicKey: "extended-public-key",
      maxEpoch: "9",
      jwtRandomness: "123",
      keyClaimName: "sub"
    });
    expect(typeof sentProverRequestBody.salt).toBe("string");
    expect(token.json.session.zkLogin.proofInputs.addressSeed).toEqual(expect.any(String));
  });

  it("repairs legacy oversized zkLogin salts before requesting a proof", async () => {
    const repository = createInMemoryDeveloperSetupRepository();
    const legacySalt = "545537731744415862780608209056738842689024020741918534729249112830043253547";
    await repository.createUserIdentity({
      issuer: "https://accounts.google.com",
      subject: "legacy",
      email: "legacy@example.com",
      displayName: "Legacy User",
      salt: legacySalt,
      walletAddress: validPackageId
    });
    const appRecord = await repository.createApp({
      developerProfileId: "profile_legacy",
      name: "Legacy Salt App",
      slug: "legacy-salt-app",
      allowedChainId: "sui:testnet",
      authProvider: "zklogin",
      allowedOrigins: ["http://localhost:3103"]
    });
    let proverSalt: string | null = null;
    const service = createDeveloperSetupService({
      repository,
      encryptionKey: "test-encryption-key-0123456789",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      developerAppOrigin: "http://localhost:3102",
      demoFrontendOrigin: "http://localhost:3103",
      googleClientId: "google-client-id",
      googleClientSecret: "google-client-secret",
      googleRedirectUri: "http://localhost:4100/v1/auth/google/callback",
      googleIssuer: "https://accounts.google.com",
      zkLoginSaltSeed: "test-zklogin-salt-seed-0123456789",
      zkLoginProverOrigin: "http://localhost:9000",
      googleOAuthClient: createMockGoogleOAuthClient(),
      zkLoginProver: {
        async requestProof(input) {
          proverSalt = input.salt;
          return {
            proof: "mock-proof"
          };
        }
      }
    });
    const legacySaltApp = createApp({ service });
    const loginRequest = await requestJson(legacySaltApp, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appRecord.app.id,
        appId: appRecord.app.id,
        redirectUri: "http://localhost:3103/auth/callback",
        zkLogin: {
          nonce: "consumer-nonce",
          extendedEphemeralPublicKey: "extended-public-key",
          maxEpoch: 9,
          jwtRandomness: "123"
        }
      }
    });
    const googleStart = await requestJson(legacySaltApp, {
      method: "GET",
      url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
    });
    const googleUrl = new URL(googleStart.redirectUrl);
    const googleCallback = await requestJson(legacySaltApp, {
      method: "GET",
      url: `/v1/auth/google/callback?code=legacy:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
    });
    const repairedIdentity = await repository.findUserIdentityByIssuerSubject("https://accounts.google.com", "legacy");

    expect(googleCallback.statusCode).toBe(302);
    expect(proverSalt).not.toBe(legacySalt);
    expect(BigInt(proverSalt ?? "0")).toBeLessThan(2n ** 128n);
    expect(repairedIdentity?.salt).toBe(proverSalt);
  });

  it("resolves the same verified Google subject to the same wallet across dashboard and app consumer auth", async () => {
    const dashboardToken = await authenticateDashboard(app, "repeat@example.com");
    const dashboardMe = await requestJson(app, {
      method: "GET",
      url: "/v1/me",
      token: dashboardToken
    });
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: dashboardToken,
      body: {
        name: "Repeat Wallet App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;
    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "http://localhost:3103/auth/callback",
        zkLogin: {
          nonce: "consumer-nonce",
          extendedEphemeralPublicKey: "extended-public-key",
          maxEpoch: 9,
          jwtRandomness: "123"
        }
      }
    });
    const googleStart = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/start?loginRequestId=${loginRequest.json.loginRequest.loginRequestId}`
    });
    const googleUrl = new URL(googleStart.redirectUrl);
    const googleCallback = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/google/callback?code=repeat:${googleUrl.searchParams.get("nonce")}&state=${googleUrl.searchParams.get("state")}`
    });
    const redirectUrl = new URL(googleCallback.redirectUrl);
    const consumerToken = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/token",
      body: {
        code: redirectUrl.searchParams.get("code"),
        state: redirectUrl.searchParams.get("state")
      }
    });

    expect(consumerToken.statusCode).toBe(200);
    expect(consumerToken.json.session.user.walletAddress).toBe(dashboardMe.json.session.user.walletAddress);
    expect(consumerToken.json.session.developerProfile).toBeNull();
    expect(consumerToken.json.session.zkLogin).toMatchObject({
      nonce: "consumer-nonce",
      extendedEphemeralPublicKey: "extended-public-key",
      maxEpoch: 9,
      proofInputs: {
        proof: "mock-proof"
      }
    });
  });

  it("returns the developer-created app name for app-scoped hosted auth requests", async () => {
    const developerToken = await authenticateDashboard(app, "app-name-auth@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Merchant Portal"
      }
    });
    const appId = createAppResponse.json.app.appId as string;

    const createdLoginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "http://localhost:3103/auth/callback",
        zkLogin: {
          nonce: "consumer-nonce",
          extendedEphemeralPublicKey: "extended-public-key",
          maxEpoch: 9,
          jwtRandomness: "123"
        }
      }
    });

    expect(createdLoginRequest.statusCode).toBe(201);
    expect(createdLoginRequest.json.loginRequest.clientId).toBe(appId);
    expect(createdLoginRequest.json.loginRequest.clientName).toBe("Merchant Portal");

    const fetchedLoginRequest = await requestJson(app, {
      method: "GET",
      url: `/v1/auth/login-requests/${createdLoginRequest.json.loginRequest.loginRequestId}`
    });

    expect(fetchedLoginRequest.statusCode).toBe(200);
    expect(fetchedLoginRequest.json.loginRequest.clientId).toBe(appId);
    expect(fetchedLoginRequest.json.loginRequest.clientName).toBe("Merchant Portal");
  });

  it("rejects invalid app consumer auth audiences", async () => {
    const missingApp = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: "missing-app",
        appId: "missing-app",
        redirectUri: "http://localhost:3103/auth/callback"
      }
    });

    expect(missingApp.statusCode).toBe(400);
    expect(missingApp.json.error).toBe("Unknown app auth audience");

    const developerToken = await authenticateDashboard(app, "consumer-audience@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Audience App"
      }
    });
    const appId = createAppResponse.json.app.appId as string;

    const invalidRedirect = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "http://localhost:3102/auth/callback"
      }
    });

    expect(invalidRedirect.statusCode).toBe(400);
    expect(invalidRedirect.json.error).toBe("App consumer redirect URI origin is not allowed for this app");

    const updateOrigins = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/allowed-origins`,
      token: developerToken,
      body: {
        allowedOrigins: ["https://updated.example/callback", "http://localhost:3103"]
      }
    });

    expect(updateOrigins.statusCode).toBe(200);
    expect(updateOrigins.json.app.allowedOrigins).toEqual(["http://localhost:3103", "https://updated.example"]);

    const updatedLoginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "https://updated.example/auth/callback"
      }
    });

    expect(updatedLoginRequest.statusCode).toBe(201);
  });

  it("uses app allowed origins for app-consumer login requests", async () => {
    const developerToken = await authenticateDashboard(app, "allowed-origin-owner@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: developerToken,
      body: {
        name: "Allowed Origin App",
        allowedOrigins: ["https://merchant.example", "https://merchant.example/app"]
      }
    });
    const appId = createAppResponse.json.app.appId as string;

    expect(createAppResponse.statusCode).toBe(201);
    expect(createAppResponse.json.app.allowedOrigins).toEqual(["https://merchant.example"]);

    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "https://merchant.example/auth/callback"
      }
    });

    expect(loginRequest.statusCode).toBe(201);

    const invalidRedirect = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "app_consumer",
        clientId: appId,
        appId,
        redirectUri: "https://evil.example/auth/callback"
      }
    });

    expect(invalidRedirect.statusCode).toBe(400);
    expect(invalidRedirect.json.error).toBe("App consumer redirect URI origin is not allowed for this app");
  });

  it("rejects invalid dashboard redirect audiences", async () => {
    const loginRequest = await requestJson(app, {
      method: "POST",
      url: "/v1/auth/login-requests",
      body: {
        clientKind: "developer_dashboard",
        clientId: "celeris-dashboard",
        redirectUri: "http://localhost:3103/auth/callback"
      }
    });

    expect(loginRequest.statusCode).toBe(400);
    expect(loginRequest.json.error).toBe("Dashboard redirect URI must target the developer app origin");
  });

  it("provisions sponsor wallets idempotently", async () => {
    const token = await authenticateDashboard(app, "wallets@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token,
      body: {
        name: "Wallet App"
      }
    });
    const appId = createAppResponse.json.app.appId;

    const firstProvision = await requestJson(app, {
      method: "POST",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token
    });
    const secondProvision = await requestJson(app, {
      method: "POST",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token
    });
    const fetchWallet = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token
    });

    expect(firstProvision.statusCode).toBe(201);
    expect(secondProvision.statusCode).toBe(201);
    expect(firstProvision.json.sponsorWallet.address).toBe(secondProvision.json.sponsorWallet.address);
    expect(firstProvision.json.sponsorWallet.suiBalanceMist).toBe("1230000000");
    expect(fetchWallet.json.sponsorWallet.address).toBe(firstProvision.json.sponsorWallet.address);
    expect(fetchWallet.json.sponsorWallet.suiBalanceMist).toBe("1230000000");
  });

  it("rejects malformed Sui IDs during program registration", async () => {
    const token = await authenticateDashboard(app, "programs@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token,
      body: {
        name: "Program App"
      }
    });

    const invalidRegistration = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${createAppResponse.json.app.appId}/program`,
      token,
      body: {
        packageId: "not-a-sui-id"
      }
    });

    expect(invalidRegistration.statusCode).toBe(400);
    expect(invalidRegistration.json.error).toBe("Validation failed");
  });

  it("persists say_hello pricing and registered program metadata", async () => {
    const token = await authenticateDashboard(app, "pricing@example.com");
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token,
      body: {
        name: "Pricing App"
      }
    });
    const appId = createAppResponse.json.app.appId;

    const registerProgram = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/program`,
      token,
      body: {
        packageId: validPackageId
      }
    });
    const configureAction = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/actions/say_hello`,
      token,
      body: {
        priceCredits: 7,
        isEnabled: true
      }
    });
    const getApp = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${appId}`,
      token
    });

    expect(registerProgram.statusCode).toBe(200);
    expect(registerProgram.json.registeredProgram.packageId).toBe(validPackageId);
    expect(configureAction.statusCode).toBe(200);
    expect(configureAction.json.sayHelloAction.priceCredits).toBe(7);
    expect(getApp.json.app.registeredProgram.packageId).toBe(validPackageId);
    expect(getApp.json.app.sayHelloAction.priceCredits).toBe(7);
  });
});
