import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createInMemoryDeveloperSetupRepository } from "../src/features/developer/repository";
import { createDeveloperSetupService } from "../src/features/developer/service";

const validPackageId = "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011";
const validAppStateObjectId = "0x6f5f67b135cb76aab0b0d3cf90a227ca31da93c1df2c0d0e42f7324de8f0fe21";
const validAuthorityCapObjectId = "0x4d26b27a54c5539f84bd4597bc39ee03dd645f8924a914c1ef0b24f6bcf4ee81";

function createTestHarness() {
  const service = createDeveloperSetupService({
    repository: createInMemoryDeveloperSetupRepository(),
    encryptionKey: "test-encryption-key-0123456789",
    apiOrigin: "http://localhost:4100",
    hostedAuthOrigin: "http://localhost:3101"
  });

  return createApp({ service });
}

async function requestJson(app: ReturnType<typeof createTestHarness>, options: {
  method: "GET" | "POST" | "PUT";
  url: string;
  body?: Record<string, unknown>;
  token?: string;
}) {
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
    json: response._isJSON() ? response._getJSONData() : null
  };
}

describe("developer setup routes", () => {
  let app: ReturnType<typeof createTestHarness>;

  beforeEach(() => {
    app = createTestHarness();
  });

  it("supports sign-up plus app create/list/get", async () => {
    const signUp = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/sign-up",
      body: {
        email: "dev@example.com",
        password: "password-123"
      }
    });

    expect(signUp.statusCode).toBe(201);
    expect(signUp.json.developer.email).toBe("dev@example.com");
    expect(signUp.json.token).toEqual(expect.any(String));

    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: signUp.json.token,
      body: {
        name: "Hello Celeris Demo"
      }
    });

    expect(createAppResponse.statusCode).toBe(201);
    expect(createAppResponse.json.app.name).toBe("Hello Celeris Demo");
    expect(createAppResponse.json.app.sdkConfig).toMatchObject({
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101"
    });

    const listApps = await requestJson(app, {
      method: "GET",
      url: "/v1/developer/apps",
      token: signUp.json.token
    });

    expect(listApps.statusCode).toBe(200);
    expect(listApps.json.apps).toHaveLength(1);

    const getApp = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${createAppResponse.json.app.appId}`,
      token: signUp.json.token
    });

    expect(getApp.statusCode).toBe(200);
    expect(getApp.json.app.appId).toBe(createAppResponse.json.app.appId);
  });

  it("provisions sponsor wallets idempotently", async () => {
    const signUp = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/sign-up",
      body: {
        email: "wallets@example.com",
        password: "password-123"
      }
    });
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: signUp.json.token,
      body: {
        name: "Wallet App"
      }
    });
    const appId = createAppResponse.json.app.appId;

    const firstProvision = await requestJson(app, {
      method: "POST",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token: signUp.json.token
    });
    const secondProvision = await requestJson(app, {
      method: "POST",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token: signUp.json.token
    });
    const fetchWallet = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${appId}/sponsor-wallet`,
      token: signUp.json.token
    });

    expect(firstProvision.statusCode).toBe(201);
    expect(secondProvision.statusCode).toBe(201);
    expect(firstProvision.json.sponsorWallet.address).toBe(secondProvision.json.sponsorWallet.address);
    expect(fetchWallet.json.sponsorWallet.address).toBe(firstProvision.json.sponsorWallet.address);
  });

  it("rejects malformed Sui IDs during program registration", async () => {
    const signUp = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/sign-up",
      body: {
        email: "programs@example.com",
        password: "password-123"
      }
    });
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: signUp.json.token,
      body: {
        name: "Program App"
      }
    });

    const invalidRegistration = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${createAppResponse.json.app.appId}/program`,
      token: signUp.json.token,
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
    const signUp = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/sign-up",
      body: {
        email: "pricing@example.com",
        password: "password-123"
      }
    });
    const createAppResponse = await requestJson(app, {
      method: "POST",
      url: "/v1/developer/apps",
      token: signUp.json.token,
      body: {
        name: "Pricing App"
      }
    });
    const appId = createAppResponse.json.app.appId;

    const registerProgram = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/program`,
      token: signUp.json.token,
      body: {
        packageId: validPackageId,
        appStateObjectId: validAppStateObjectId,
        authorityCapObjectId: validAuthorityCapObjectId
      }
    });
    const configureAction = await requestJson(app, {
      method: "PUT",
      url: `/v1/developer/apps/${appId}/actions/say_hello`,
      token: signUp.json.token,
      body: {
        priceCredits: 7,
        isEnabled: true
      }
    });
    const getApp = await requestJson(app, {
      method: "GET",
      url: `/v1/developer/apps/${appId}`,
      token: signUp.json.token
    });

    expect(registerProgram.statusCode).toBe(200);
    expect(registerProgram.json.registeredProgram.packageId).toBe(validPackageId);
    expect(configureAction.statusCode).toBe(200);
    expect(configureAction.json.sayHelloAction.priceCredits).toBe(7);
    expect(getApp.json.app.registeredProgram.packageId).toBe(validPackageId);
    expect(getApp.json.app.sayHelloAction.priceCredits).toBe(7);
  });
});
