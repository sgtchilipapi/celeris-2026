import type { RequestHandler } from "express";

export interface CorsMiddlewareOptions {
  allowedOrigins: string[];
}

const allowedMethods = ["GET", "POST", "PUT", "OPTIONS"].join(",");
const allowedHeaders = ["authorization", "content-type", "x-request-id"].join(",");

function normalizeOrigins(origins: string[]) {
  return new Set(
    origins
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin)
  );
}

export function createCorsMiddleware(options: CorsMiddlewareOptions): RequestHandler {
  const allowedOrigins = normalizeOrigins(options.allowedOrigins);

  return (req, res, next) => {
    const requestOrigin = req.header("origin");
    const isAllowedOrigin = requestOrigin ? allowedOrigins.has(requestOrigin) : false;

    if (requestOrigin && isAllowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", allowedMethods);
      res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
      res.setHeader("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
