import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;

  if (error instanceof ZodError) {
    logger.error("request.validation_failed", {
      requestId,
      issues: error.issues
    });

    res.status(400).json({
      error: "Validation failed",
      requestId,
      issues: error.issues
    });
    return;
  }

  logger.error("request.failed", {
    requestId,
    error: error instanceof Error ? error.message : String(error)
  });

  res.status(500).json({
    error: "Internal Server Error",
    requestId
  });
};
