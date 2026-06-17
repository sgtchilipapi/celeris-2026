import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  requestId: z.string().min(1)
});

export const healthDiagnosticStatusSchema = z.union([z.literal("ok"), z.literal("error")]);

export const healthDiagnosticsResponseSchema = z.object({
  status: healthDiagnosticStatusSchema,
  service: z.string().min(1),
  requestId: z.string().min(1),
  checks: z.object({
    googleAuthConfiguration: z.object({
      status: healthDiagnosticStatusSchema,
      issuer: z.string().min(1),
      redirectUri: z.string().url()
    }),
    zkLoginProver: z.object({
      status: healthDiagnosticStatusSchema,
      origin: z.string().url(),
      error: z.string().optional()
    }),
    suiRpc: z.object({
      status: healthDiagnosticStatusSchema,
      origin: z.string().url(),
      error: z.string().optional()
    })
  })
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthDiagnosticsResponse = z.infer<typeof healthDiagnosticsResponseSchema>;
