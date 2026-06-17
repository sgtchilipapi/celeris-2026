import { createHash } from "node:crypto";
import { computeZkLoginAddress } from "@mysten/sui/zklogin";
import { z } from "zod";
import { authProviderSchema, chainIdSchema } from "./env";
import { parseSuiAddress, parseSuiObjectId, parseSuiPackageId } from "./sui/hello-celeris";

export const CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO = "say_hello" as const;
export const CELERIS_CHAIN_FAMILY_SUI = "sui" as const;
export const CELERIS_NETWORK_TESTNET = "testnet" as const;
export const CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD = "developer_dashboard" as const;
export const CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER = "app_consumer" as const;
export const CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD = "celeris-dashboard" as const;
export const CELERIS_AUTH_ISSUER = "https://auth.celeris.pro" as const;

export const developerEmailSchema = z.email().transform((value) => value.trim().toLowerCase());

function createNormalizedSuiStringSchema(normalizer: (value: string) => string) {
  return z
    .string()
    .trim()
    .superRefine((value, context) => {
      try {
        normalizer(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "Invalid Sui value"
        });
      }
    })
    .transform((value) => normalizer(value));
}

export const suiAddressSchema = createNormalizedSuiStringSchema(parseSuiAddress);
export const suiObjectIdSchema = createNormalizedSuiStringSchema(parseSuiObjectId);
export const suiPackageIdSchema = createNormalizedSuiStringSchema(parseSuiPackageId);

export const developerSummarySchema = z.object({
  id: z.string().min(1),
  email: developerEmailSchema,
  displayName: z.string().trim().min(1).nullable()
});

export const developerProfileResponseSchema = z.object({
  developerProfile: developerSummarySchema
});

export const authClientKindSchema = z.union([
  z.literal(CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD),
  z.literal(CELERIS_AUTH_CLIENT_KIND_APP_CONSUMER)
]);

export const createAuthLoginRequestSchema = z.object({
  clientKind: authClientKindSchema.default(CELERIS_AUTH_CLIENT_KIND_DEVELOPER_DASHBOARD),
  clientId: z.string().trim().min(1).default(CELERIS_AUTH_CLIENT_ID_DEVELOPER_DASHBOARD),
  redirectUri: z.string().url(),
  appId: z.string().min(1).optional(),
  zkLogin: z
    .object({
      nonce: z.string().trim().min(1),
      extendedEphemeralPublicKey: z.string().trim().min(1),
      maxEpoch: z.coerce.number().int().nonnegative(),
      jwtRandomness: z.string().trim().min(1).optional()
    })
    .optional()
});

export const authLoginRequestSchema = z.object({
  loginRequestId: z.string().min(1),
  clientKind: authClientKindSchema,
  clientId: z.string().min(1),
  appId: z.string().min(1).nullable().optional(),
  redirectUri: z.string().url(),
  state: z.string().min(1),
  nonce: z.string().min(1).nullable().optional(),
  maxEpoch: z.number().int().nonnegative().nullable().optional(),
  expiresAt: z.string().datetime(),
  authUrl: z.string().url()
});

export const authLoginRequestResponseSchema = z.object({
  loginRequest: authLoginRequestSchema
});

export const authLoginCompletionSchema = z.object({
  email: developerEmailSchema,
  displayName: z.string().trim().min(1).max(80).optional()
});

export const authLoginCompletionResponseSchema = z.object({
  redirectTo: z.string().url()
});

export const authTokenExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

export const zkLoginSessionMaterialSchema = z.object({
  nonce: z.string().min(1).nullable(),
  extendedEphemeralPublicKey: z.string().min(1).nullable(),
  maxEpoch: z.number().int().nonnegative().nullable(),
  proofInputs: z.record(z.string(), z.unknown()).nullable()
});

export const authSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
  clientKind: authClientKindSchema,
  clientId: z.string().min(1),
  appId: z.string().min(1).nullable(),
  user: z.object({
    id: z.string().min(1),
    email: developerEmailSchema,
    walletAddress: suiAddressSchema
  }),
  developerProfile: developerSummarySchema.nullable(),
  zkLogin: zkLoginSessionMaterialSchema.nullable()
});

export const authSessionResponseSchema = z.object({
  session: authSessionSchema
});

export const meResponseSchema = z.object({
  session: authSessionSchema
});

export const createDeveloperAppSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(80, "name must be at most 80 characters"),
  allowedChainId: chainIdSchema.default("sui:testnet"),
  authProvider: authProviderSchema.default("zklogin")
});

export const sponsorWalletSchema = z.object({
  chainFamily: z.literal(CELERIS_CHAIN_FAMILY_SUI),
  network: z.literal(CELERIS_NETWORK_TESTNET),
  address: suiAddressSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const registeredProgramSchema = z.object({
  chainFamily: z.literal(CELERIS_CHAIN_FAMILY_SUI),
  network: z.literal(CELERIS_NETWORK_TESTNET),
  packageId: suiPackageIdSchema,
  appStateObjectId: suiObjectIdSchema,
  authorityCapObjectId: suiObjectIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const registerProgramSchema = z.object({
  packageId: suiPackageIdSchema,
  appStateObjectId: suiObjectIdSchema,
  authorityCapObjectId: suiObjectIdSchema
});

export const managedActionSchema = z.object({
  actionType: z.literal(CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO),
  priceCredits: z.number().int().nonnegative(),
  isEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const configureSayHelloSchema = z.object({
  priceCredits: z.coerce.number().int().nonnegative(),
  isEnabled: z.boolean().default(true)
});

export const developerAppSchema = z.object({
  appId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  allowedChainId: chainIdSchema,
  authProvider: authProviderSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sponsorWallet: sponsorWalletSchema.nullable(),
  registeredProgram: registeredProgramSchema.nullable(),
  sayHelloAction: managedActionSchema.nullable(),
  sdkConfig: z.object({
    appId: z.string().min(1),
    allowedChainId: chainIdSchema,
    authProvider: authProviderSchema,
    apiOrigin: z.string().url(),
    hostedAuthOrigin: z.string().url(),
    demoOrigin: z.string().url()
  })
});

export const developerAppListResponseSchema = z.object({
  apps: z.array(developerAppSchema)
});

export const developerAppResponseSchema = z.object({
  app: developerAppSchema
});

export const sponsorWalletResponseSchema = z.object({
  sponsorWallet: sponsorWalletSchema
});

export const registeredProgramResponseSchema = z.object({
  registeredProgram: registeredProgramSchema
});

export const managedActionResponseSchema = z.object({
  sayHelloAction: managedActionSchema
});

export function deriveDeterministicWalletAddress(subject: string) {
  const hash = createHash("sha256").update(subject).digest("hex");
  return parseSuiAddress(`0x${hash.slice(0, 64)}`);
}

export function deriveZkLoginSalt(seed: string, issuer: string, subject: string) {
  const bn254FieldSize = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const hash = createHash("sha256").update(`${seed}:${issuer}:${subject}`).digest("hex");
  return (BigInt(`0x${hash}`) % bn254FieldSize).toString(10);
}

export function deriveZkLoginWalletAddress(input: { issuer: string; subject: string; aud: string; salt: string }) {
  return parseSuiAddress(
    computeZkLoginAddress({
      claimName: "sub",
      claimValue: input.subject,
      iss: input.issuer,
      aud: input.aud,
      userSalt: input.salt
    })
  );
}

export type DeveloperSummary = z.infer<typeof developerSummarySchema>;
export type CreateAuthLoginRequestInput = z.infer<typeof createAuthLoginRequestSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLoginCompletionInput = z.infer<typeof authLoginCompletionSchema>;
export type AuthTokenExchangeInput = z.infer<typeof authTokenExchangeSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type CreateDeveloperAppInput = z.infer<typeof createDeveloperAppSchema>;
export type DeveloperApp = z.infer<typeof developerAppSchema>;
export type SponsorWallet = z.infer<typeof sponsorWalletSchema>;
export type RegisteredProgram = z.infer<typeof registeredProgramSchema>;
export type RegisterProgramInput = z.infer<typeof registerProgramSchema>;
export type ManagedAction = z.infer<typeof managedActionSchema>;
export type ConfigureSayHelloInput = z.infer<typeof configureSayHelloSchema>;
