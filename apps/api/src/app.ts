import { parseApiEnv } from "@celeris/shared";
import express from "express";
import { createDeveloperRouter, type DeveloperRouterOptions } from "./features/developer/router";
import { createCorsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { requestLoggerMiddleware } from "./middleware/request-logger";
import { healthRouter } from "./routes/health";

const developmentTunnelOrigins = [
  "https://celeris.pro",
  "https://app.celeris.pro",
  "https://demo.celeris.pro",
  "https://auth.celeris.pro"
];

export interface CreateAppOptions extends DeveloperRouterOptions {
  corsAllowedOrigins?: string[];
}

function getDefaultCorsAllowedOrigins() {
  const env = parseApiEnv(process.env);
  const configuredOrigins = [
    process.env.CELERIS_PUBLIC_SITE_ORIGIN ?? "https://celeris.pro",
    env.CELERIS_DEVELOPER_APP_ORIGIN,
    env.CELERIS_DEMO_FRONTEND_ORIGIN,
    env.CELERIS_HOSTED_AUTH_ORIGIN
  ];

  if (env.NODE_ENV === "production") {
    return configuredOrigins;
  }

  return [...configuredOrigins, ...developmentTunnelOrigins];
}

export function createApp(options?: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(createCorsMiddleware({ allowedOrigins: options?.corsAllowedOrigins ?? getDefaultCorsAllowedOrigins() }));
  app.use(express.json());
  app.use(healthRouter);
  app.use(createDeveloperRouter(options));
  app.use(errorHandler);

  return app;
}
