import { createHash } from "node:crypto";
import { computeZkLoginAddress } from "@mysten/sui/zklogin";
import { z } from "zod";
import { authProviderSchema, chainIdSchema } from "./env";
import { buildHelloCelerisSayHelloTransaction, parseSuiAddress, parseSuiObjectId, parseSuiPackageId } from "./sui/hello-celeris";

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

export const catalogActionSchema = z.object({
  actionType: z.literal(CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO),
  priceCredits: z.number().int().nonnegative(),
  isEnabled: z.boolean()
});

export const appCatalogSchema = z.object({
  appId: z.string().min(1),
  chainId: chainIdSchema,
  actions: z.array(catalogActionSchema),
  registeredProgram: registeredProgramSchema.nullable()
});

export const appCatalogResponseSchema = z.object({
  catalog: appCatalogSchema
});

export const appBalanceSchema = z.object({
  appId: z.string().min(1),
  walletAddress: suiAddressSchema,
  chainId: chainIdSchema,
  availableCredits: z.number().int()
});

export const appBalanceResponseSchema = z.object({
  balance: appBalanceSchema
});

export const checkoutSessionStatusSchema = z.union([
  z.literal("pending"),
  z.literal("completed"),
  z.literal("canceled")
]);

export const createCheckoutSessionSchema = z.object({
  credits: z.coerce.number().int().positive().max(100_000),
  successRedirectUrl: z.string().url().optional(),
  cancelRedirectUrl: z.string().url().optional()
});

export const checkoutSessionSchema = z.object({
  checkoutSessionId: z.string().min(1),
  appId: z.string().min(1),
  walletAddress: suiAddressSchema,
  chainId: chainIdSchema,
  credits: z.number().int().positive(),
  status: checkoutSessionStatusSchema,
  checkoutUrl: z.string().url(),
  successRedirectUrl: z.string().url(),
  cancelRedirectUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const checkoutSessionResponseSchema = z.object({
  checkoutSession: checkoutSessionSchema
});

export const completeCheckoutSessionResponseSchema = z.object({
  checkoutSession: checkoutSessionSchema,
  balance: appBalanceSchema
});

export const executeSayHelloSchema = z.object({
  username: z.string().trim().min(1),
  transactionKind: z.unknown()
});

export const sayHelloSponsorshipSchema = z.object({
  reservationId: z.string().min(1),
  transactionBytes: z.string().min(1),
  sponsorSignature: z.string().min(1),
  sponsorAddress: suiAddressSchema,
  expiresAt: z.string().datetime(),
  username: z.string().min(1),
  message: z.string().min(1)
});

export const sayHelloSponsorshipResponseSchema = z.object({
  sponsorship: sayHelloSponsorshipSchema,
  balance: appBalanceSchema
});

export const completeSayHelloSchema = z.object({
  reservationId: z.string().min(1),
  outcome: z.union([z.literal("submitted"), z.literal("failed")]),
  digest: z.string().trim().min(1).optional()
});

export const transactionRecordStatusSchema = z.union([
  z.literal("submitted"),
  z.literal("confirmed"),
  z.literal("failed")
]);

export const transactionRecordSchema = z.object({
  transactionId: z.string().min(1),
  appId: z.string().min(1),
  actionType: z.literal(CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO),
  walletAddress: suiAddressSchema,
  chainId: chainIdSchema,
  username: z.string().min(1),
  message: z.string().min(1),
  digest: z.string().min(1),
  explorerUrl: z.string().url(),
  status: transactionRecordStatusSchema,
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
});

export const appTransactionsResponseSchema = z.object({
  transactions: z.array(transactionRecordSchema)
});

export const completeSayHelloResponseSchema = z.object({
  reservationId: z.string().min(1),
  status: z.union([z.literal("captured"), z.literal("released")]),
  balance: appBalanceSchema,
  transaction: transactionRecordSchema.nullable()
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
  const hash = createHash("sha256").update(`${seed}:${issuer}:${subject}`).digest();
  return BigInt(`0x${hash.subarray(0, 16).toString("hex")}`).toString(10);
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

export function buildSayHelloTransactionKindForApi(input: {
  packageId: string;
  authorityCapObjectId: string;
  appStateObjectId: string;
  username: string;
}) {
  return buildHelloCelerisSayHelloTransaction({
    packageId: input.packageId,
    appAuthorityCapObjectId: input.authorityCapObjectId,
    appStateObjectId: input.appStateObjectId,
    username: input.username
  }).transactionKind;
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
export type CatalogAction = z.infer<typeof catalogActionSchema>;
export type AppCatalog = z.infer<typeof appCatalogSchema>;
export type AppBalance = z.infer<typeof appBalanceSchema>;
export type CheckoutSessionStatus = z.infer<typeof checkoutSessionStatusSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;
export type ExecuteSayHelloInput = z.infer<typeof executeSayHelloSchema>;
export type SayHelloSponsorship = z.infer<typeof sayHelloSponsorshipSchema>;
export type CompleteSayHelloInput = z.infer<typeof completeSayHelloSchema>;
export type TransactionRecordStatus = z.infer<typeof transactionRecordStatusSchema>;
export type AppTransactionRecord = z.infer<typeof transactionRecordSchema>;
