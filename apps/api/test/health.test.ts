import { EventEmitter } from "node:events";
import { createRequest, createResponse } from "node-mocks-http";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
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
