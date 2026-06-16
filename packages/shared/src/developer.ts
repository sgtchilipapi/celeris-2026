import { z } from "zod";
import {
  authProviderSchema,
  chainIdSchema
} from "./env";
import {
  parseSuiAddress,
  parseSuiObjectId,
  parseSuiPackageId
} from "./sui/hello-celeris";

export const CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO = "say_hello" as const;
export const CELERIS_CHAIN_FAMILY_SUI = "sui" as const;
export const CELERIS_NETWORK_TESTNET = "testnet" as const;

export const developerEmailSchema = z.email().transform((value) => value.trim().toLowerCase());
export const developerPasswordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(128, "password must be at most 128 characters");

export const developerCredentialsSchema = z.object({
  email: developerEmailSchema,
  password: developerPasswordSchema
});

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
  email: developerEmailSchema
});

export const developerSessionResponseSchema = z.object({
  developer: developerSummarySchema,
  token: z.string().min(1),
  expiresAt: z.string().datetime()
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
    hostedAuthOrigin: z.string().url()
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

export type DeveloperCredentials = z.infer<typeof developerCredentialsSchema>;
export type DeveloperSessionResponse = z.infer<typeof developerSessionResponseSchema>;
export type CreateDeveloperAppInput = z.infer<typeof createDeveloperAppSchema>;
export type DeveloperApp = z.infer<typeof developerAppSchema>;
export type SponsorWallet = z.infer<typeof sponsorWalletSchema>;
export type RegisteredProgram = z.infer<typeof registeredProgramSchema>;
export type RegisterProgramInput = z.infer<typeof registerProgramSchema>;
export type ManagedAction = z.infer<typeof managedActionSchema>;
export type ConfigureSayHelloInput = z.infer<typeof configureSayHelloSchema>;
