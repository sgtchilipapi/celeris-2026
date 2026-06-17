import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryDeveloperSetupRepository } from "../src/features/developer/repository";
import type { GoogleOAuthClient, VerifiedGoogleIdentity, ZkLoginProver } from "../src/features/developer/service";
import { createDeveloperSetupService } from "../src/features/developer/service";
import { unauthorized } from "../src/lib/http-error";

const validPackageId = "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011";
const validAppStateObjectId = "0x6f5f67b135cb76aab0b0d3cf90a227ca31da93c1df2c0d0e42f7324de8f0fe21";
const validAuthorityCapObjectId = "0x4d26b27a54c5539f84bd4597bc39ee03dd645f8924a914c1ef0b24f6bcf4ee81";

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

function createTestHarness() {
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
    zkLoginProver: mockZkLoginProver
  });

  return createApp({ service });
}

async function requestJson(
  app: ReturnType<typeof createTestHarness>,
  options: {
    method: "GET" | "POST" | "PUT";
    url: string;
    body?: Record<string, unknown>;
    token?: string;
  }
) {
  const appHandler = app as unknown as {
    handle: (request: unknown, response: unknown, next: (error?: unknown) => void) => void;
  };
  const request = createRequest({
    method: options.method,
    url: options.url,
    headers: options.token
      ? {
          authorization: `Bearer ${options.token}`
        }
      : undefined,
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

describe("developer setup routes", () => {
  let app: ReturnType<typeof createTestHarness>;

  beforeEach(() => {
    app = createTestHarness();
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
    expect(invalidRedirect.json.error).toBe("App consumer redirect URI must target the demo origin");
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
    expect(fetchWallet.json.sponsorWallet.address).toBe(firstProvision.json.sponsorWallet.address);
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
        packageId: "not-a-sui-id",
        appStateObjectId: validAppStateObjectId,
        authorityCapObjectId: validAuthorityCapObjectId
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
        packageId: validPackageId,
        appStateObjectId: validAppStateObjectId,
        authorityCapObjectId: validAuthorityCapObjectId
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
