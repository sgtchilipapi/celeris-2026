import { z } from "zod";

export const chainIdSchema = z.literal("sui:testnet");
export const authProviderSchema = z.literal("zklogin");

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4100),
  API_ORIGIN: z.string().url().default("http://localhost:4100"),
  CELERIS_APP_ENCRYPTION_KEY: z.string().min(16).default("development-celeris-app-encryption-key"),
  CELERIS_DEVELOPER_APP_ORIGIN: z.string().url().default("http://localhost:3101"),
  CELERIS_DEMO_FRONTEND_ORIGIN: z.string().url().default("http://localhost:3101"),
  CELERIS_HOSTED_AUTH_ORIGIN: z.string().url().default("http://localhost:3101"),
  CELERIS_GOOGLE_CLIENT_ID: z.string().min(1).default("development-google-client-id"),
  CELERIS_GOOGLE_CLIENT_SECRET: z.string().min(1).default("development-google-client-secret"),
  CELERIS_GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:4100/v1/auth/google/callback"),
  CELERIS_GOOGLE_ISSUER: z.string().min(1).default("https://accounts.google.com"),
  CELERIS_ZKLOGIN_SALT_SEED: z.string().min(16).default("development-celeris-zklogin-salt-seed"),
  CELERIS_ZKLOGIN_PROVER_ORIGIN: z.string().url().default("http://localhost:9000"),
  CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW: z.coerce.number().int().positive().default(2)
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") {
    return;
  }

  const productionRequiredFields = [
    "CELERIS_GOOGLE_CLIENT_ID",
    "CELERIS_GOOGLE_CLIENT_SECRET",
    "CELERIS_GOOGLE_REDIRECT_URI",
    "CELERIS_ZKLOGIN_SALT_SEED",
    "CELERIS_ZKLOGIN_PROVER_ORIGIN"
  ] as const;

  for (const field of productionRequiredFields) {
    if (value[field].startsWith("development-") || value[field].includes("localhost")) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} must be explicitly configured in production`
      });
    }
  }
});

export const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_API_ORIGIN: z.string().url().default("https://api.celeris.pro"),
  NEXT_PUBLIC_DEVELOPER_APP_ORIGIN: z.string().url().default("https://app.celeris.pro"),
  NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN: z.string().url().default("https://demo.celeris.pro"),
  NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: z.string().url().default("https://auth.celeris.pro"),
  NEXT_PUBLIC_DEMO_APP_ID: z.string().trim().default("")
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required")
});

function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  env: Record<string, string | undefined>,
  source: string
) {
  const result = schema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid ${source} environment configuration: ${details}`);
  }

  return result.data;
}

export function parseApiEnv(env: Record<string, string | undefined>) {
  return parseEnv(apiEnvSchema, env, "API");
}

export function parseWebEnv(env: Record<string, string | undefined>) {
  return parseEnv(webEnvSchema, env, "web");
}

export function parseDatabaseEnv(env: Record<string, string | undefined>) {
  return parseEnv(databaseEnvSchema, env, "database");
}
