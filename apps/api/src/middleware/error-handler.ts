import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";
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

  if (error instanceof HttpError) {
    logger.error("request.http_error", {
      requestId,
      statusCode: error.statusCode,
      error: error.message,
      details: error.details
    });

    res.status(error.statusCode).json({
      error: error.message,
      requestId,
      details: error.details
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
