import { healthResponseSchema } from "@celeris/shared";
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const response = healthResponseSchema.parse({
    status: "ok",
    service: "api",
    requestId: res.locals.requestId as string
  });

  res.json(response);
});
