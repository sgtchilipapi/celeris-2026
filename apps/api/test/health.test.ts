import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

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
  CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW: process.env.CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW
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

describe("GET /health", () => {
  beforeEach(() => {
    setRequiredApiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns a healthy API response and a request id header", async () => {
    const app = createApp();
    const appHandler = app as unknown as {
      handle: (request: unknown, response: unknown, next: (error?: unknown) => void) => void;
    };
    const request = createRequest({
      method: "GET",
      url: "/health"
    });
    const response = createResponse({
      eventEmitter: EventEmitter
    });

    await new Promise<void>((resolve, reject) => {
      response.on("end", resolve);
      appHandler.handle(request, response, reject);
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(response._getJSONData()).toMatchObject({
      status: "ok",
      service: "api"
    });
  });
});
