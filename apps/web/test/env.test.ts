import { describe, expect, it } from "vitest";
import { normalizeWebRuntimeConfigForHost } from "../src/env";

describe("getWebRuntimeConfig", () => {
  it("rewrites localhost public origins when served through the Celeris tunnel", () => {
    expect(
      normalizeWebRuntimeConfigForHost(
        {
          NODE_ENV: "development",
          NEXT_PUBLIC_API_ORIGIN: "http://localhost:4100",
          NEXT_PUBLIC_DEVELOPER_APP_ORIGIN: "http://localhost:3101",
          NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN: "http://localhost:3101",
          NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: "http://localhost:3101",
          NEXT_PUBLIC_DEMO_APP_ID: ""
        },
        "auth.celeris.pro"
      )
    ).toMatchObject({
      NEXT_PUBLIC_API_ORIGIN: "https://api.celeris.pro",
      NEXT_PUBLIC_DEVELOPER_APP_ORIGIN: "https://app.celeris.pro",
      NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN: "https://demo.celeris.pro",
      NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: "https://auth.celeris.pro"
    });
  });
});
