import { z } from "zod";

export const chainIdSchema = z.literal("sui:testnet");
export const authProviderSchema = z.literal("zklogin");

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_ORIGIN: z.string().url().default("http://localhost:4000")
});

export const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_API_ORIGIN: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: z.string().url().default("http://localhost:3100")
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
