import express from "express";
import { createDeveloperRouter, type DeveloperRouterOptions } from "./features/developer/router";
import { errorHandler } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { requestLoggerMiddleware } from "./middleware/request-logger";
import { healthRouter } from "./routes/health";

export interface CreateAppOptions extends DeveloperRouterOptions {}

export function createApp(options?: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(express.json());
  app.use(healthRouter);
  app.use(createDeveloperRouter(options));
  app.use(errorHandler);

  return app;
}
