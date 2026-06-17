import { describe, expect, it } from "vitest";
import { parseApiEnv } from "../src/env";

describe("parseApiEnv", () => {
  it("requires explicit Google and zkLogin prover configuration", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "development"
      })
    ).toThrow(/CELERIS_GOOGLE_CLIENT_ID/);
  });

  it("accepts explicit Google and zkLogin prover configuration", () => {
    expect(
      parseApiEnv({
        NODE_ENV: "development",
        API_ORIGIN: "http://localhost:4100",
        CELERIS_APP_ENCRYPTION_KEY: "test-encryption-key-0123456789",
        CELERIS_DEVELOPER_APP_ORIGIN: "http://localhost:3101",
        CELERIS_DEMO_FRONTEND_ORIGIN: "http://localhost:3101",
        CELERIS_HOSTED_AUTH_ORIGIN: "http://localhost:3101",
        CELERIS_GOOGLE_CLIENT_ID: "google-client-id",
        CELERIS_GOOGLE_CLIENT_SECRET: "google-client-secret",
        CELERIS_GOOGLE_REDIRECT_URI: "http://localhost:4100/v1/auth/google/callback",
        CELERIS_GOOGLE_ISSUER: "https://accounts.google.com",
        CELERIS_ZKLOGIN_SALT_SEED: "test-zklogin-salt-seed-0123456789",
        CELERIS_ZKLOGIN_PROVER_ORIGIN: "http://localhost:9000",
        CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW: "2"
      })
    ).toMatchObject({
      CELERIS_GOOGLE_CLIENT_ID: "google-client-id",
      CELERIS_ZKLOGIN_PROVER_ORIGIN: "http://localhost:9000",
      CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW: 2
    });
  });
});
