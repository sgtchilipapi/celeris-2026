import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

async function request(
  app: ReturnType<typeof createApp>,
  options: {
    method: "GET" | "OPTIONS" | "POST";
    url: string;
    headers?: Record<string, string>;
  }
) {
  const appHandler = app as unknown as {
    handle: (request: unknown, response: unknown, next: (error?: unknown) => void) => void;
  };
  const req = createRequest({
    method: options.method,
    url: options.url,
    headers: options.headers
  });
  const res = createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise<void>((resolve, reject) => {
    res.on("end", resolve);
    appHandler.handle(req, res, reject);
  });

  return res;
}

describe("CORS middleware", () => {
  it("answers auth preflight requests from the hosted auth origin", async () => {
    const app = createApp({
      corsAllowedOrigins: ["https://auth.celeris.pro"]
    });
    const response = await request(app, {
      method: "OPTIONS",
      url: "/v1/auth/login-requests",
      headers: {
        origin: "https://auth.celeris.pro",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.getHeader("access-control-allow-origin")).toBe("https://auth.celeris.pro");
    expect(response.getHeader("access-control-allow-methods")).toContain("POST");
    expect(response.getHeader("access-control-allow-headers")).toContain("content-type");
    expect(response.getHeader("vary")).toBe("Origin");
  });

  it("does not allow unconfigured origins", async () => {
    const app = createApp({
      corsAllowedOrigins: ["https://auth.celeris.pro"]
    });
    const response = await request(app, {
      method: "OPTIONS",
      url: "/v1/auth/login-requests",
      headers: {
        origin: "https://malicious.example",
        "access-control-request-method": "POST"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.getHeader("access-control-allow-origin")).toBeUndefined();
  });

  it("adds CORS headers to regular responses from allowed origins", async () => {
    const app = createApp({
      corsAllowedOrigins: ["https://auth.celeris.pro"]
    });
    const response = await request(app, {
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://auth.celeris.pro"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("access-control-allow-origin")).toBe("https://auth.celeris.pro");
  });
});
