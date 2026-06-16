import { randomUUID } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  CELERIS_CHAIN_FAMILY_SUI,
  CELERIS_NETWORK_TESTNET,
  authProviderSchema,
  chainIdSchema,
  type ConfigureSayHelloInput,
  configureSayHelloSchema,
  type CreateDeveloperAppInput,
  createDeveloperAppSchema,
  type DeveloperApp,
  type DeveloperCredentials,
  developerCredentialsSchema,
  type DeveloperSessionResponse,
  registerProgramSchema,
  type RegisterProgramInput
} from "@celeris/shared";
import { conflict, notFound, unauthorized } from "../../lib/http-error";
import { encryptSecret, generateOpaqueToken, hashPassword, sha256, verifyPassword } from "./crypto";
import type {
  DeveloperAppAggregateRecord,
  DeveloperSessionWithDeveloperRecord,
  DeveloperSetupRepository,
  ManagedActionRecord,
  RegisteredProgramRecord,
  SponsorWalletRecord
} from "./repository";
import { createPrismaDeveloperSetupRepository } from "./repository";

const DEVELOPER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeveloperSetupServiceOptions {
  repository?: DeveloperSetupRepository;
  encryptionKey: string;
  apiOrigin: string;
  hostedAuthOrigin: string;
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function toDeveloperSummary(record: DeveloperSessionWithDeveloperRecord["developer"]) {
  return {
    id: record.id,
    email: record.email
  };
}

function toRuntimeConfig(options: Pick<DeveloperSetupServiceOptions, "apiOrigin" | "hostedAuthOrigin">) {
  return {
    apiOrigin: options.apiOrigin,
    hostedAuthOrigin: options.hostedAuthOrigin
  };
}

function toSponsorWallet(record: SponsorWalletRecord) {
  return {
    chainFamily: CELERIS_CHAIN_FAMILY_SUI,
    network: CELERIS_NETWORK_TESTNET,
    address: record.address,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toRegisteredProgram(record: RegisteredProgramRecord) {
  return {
    chainFamily: CELERIS_CHAIN_FAMILY_SUI,
    network: CELERIS_NETWORK_TESTNET,
    packageId: record.packageId,
    appStateObjectId: record.appStateObjectId,
    authorityCapObjectId: record.authorityCapObjectId,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toManagedAction(record: ManagedActionRecord) {
  return {
    actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
    priceCredits: record.priceCredits,
    isEnabled: record.isEnabled,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt)
  };
}

function toDeveloperApp(
  aggregate: DeveloperAppAggregateRecord,
  runtimeConfig: Pick<DeveloperSetupServiceOptions, "apiOrigin" | "hostedAuthOrigin">
): DeveloperApp {
  return {
    appId: aggregate.app.id,
    name: aggregate.app.name,
    slug: aggregate.app.slug,
    allowedChainId: chainIdSchema.parse(aggregate.app.allowedChainId),
    authProvider: authProviderSchema.parse(aggregate.app.authProvider),
    createdAt: toIsoString(aggregate.app.createdAt),
    updatedAt: toIsoString(aggregate.app.updatedAt),
    sponsorWallet: aggregate.sponsorWallet ? toSponsorWallet(aggregate.sponsorWallet) : null,
    registeredProgram: aggregate.registeredProgram ? toRegisteredProgram(aggregate.registeredProgram) : null,
    sayHelloAction: aggregate.sayHelloAction ? toManagedAction(aggregate.sayHelloAction) : null,
    sdkConfig: {
      appId: aggregate.app.id,
      allowedChainId: chainIdSchema.parse(aggregate.app.allowedChainId),
      authProvider: authProviderSchema.parse(aggregate.app.authProvider),
      apiOrigin: runtimeConfig.apiOrigin,
      hostedAuthOrigin: runtimeConfig.hostedAuthOrigin
    }
  };
}

function slugifyName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "celeris-app";
}

export class DeveloperSetupService {
  private readonly repository: DeveloperSetupRepository;
  private readonly encryptionKey: string;
  private readonly apiOrigin: string;
  private readonly hostedAuthOrigin: string;

  constructor(options: DeveloperSetupServiceOptions) {
    this.repository = options.repository ?? createPrismaDeveloperSetupRepository();
    this.encryptionKey = options.encryptionKey;
    this.apiOrigin = options.apiOrigin;
    this.hostedAuthOrigin = options.hostedAuthOrigin;
  }

  async signUp(input: DeveloperCredentials): Promise<DeveloperSessionResponse> {
    const credentials = developerCredentialsSchema.parse(input);
    const existing = await this.repository.findDeveloperAccountByEmail(credentials.email);

    if (existing) {
      throw conflict("Developer account already exists");
    }

    const developer = await this.repository.createDeveloperAccount({
      email: credentials.email,
      passwordHash: await hashPassword(credentials.password)
    });

    return this.createSessionResponse(developer.id, developer.email);
  }

  async signIn(input: DeveloperCredentials): Promise<DeveloperSessionResponse> {
    const credentials = developerCredentialsSchema.parse(input);
    const developer = await this.repository.findDeveloperAccountByEmail(credentials.email);

    if (!developer || !(await verifyPassword(credentials.password, developer.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }

    return this.createSessionResponse(developer.id, developer.email);
  }

  async signOut(token: string) {
    await this.repository.deleteDeveloperSessionByTokenHash(sha256(token));
  }

  async authenticateDeveloper(token: string) {
    const session = await this.repository.findDeveloperSessionByTokenHash(sha256(token));

    if (!session || session.session.expiresAt.getTime() <= Date.now()) {
      throw unauthorized();
    }

    return toDeveloperSummary(session.developer);
  }

  async listApps(developerId: string) {
    const apps = await this.repository.listAppsByDeveloperId(developerId);
    return apps.map((app) =>
      toDeveloperApp(app, {
        apiOrigin: this.apiOrigin,
        hostedAuthOrigin: this.hostedAuthOrigin
      })
    );
  }

  async createApp(developerId: string, input: CreateDeveloperAppInput) {
    const payload = createDeveloperAppSchema.parse(input);
    const created = await this.repository.createApp({
      developerId,
      name: payload.name,
      slug: `${slugifyName(payload.name)}-${randomUUID().slice(0, 8)}`,
      allowedChainId: payload.allowedChainId,
      authProvider: payload.authProvider
    });

    return toDeveloperApp(created, {
      apiOrigin: this.apiOrigin,
      hostedAuthOrigin: this.hostedAuthOrigin
    });
  }

  async getApp(developerId: string, appId: string) {
    const app = await this.requireApp(developerId, appId);
    return toDeveloperApp(app, {
      apiOrigin: this.apiOrigin,
      hostedAuthOrigin: this.hostedAuthOrigin
    });
  }

  async provisionSponsorWallet(developerId: string, appId: string) {
    await this.requireApp(developerId, appId);
    const existing = await this.repository.findSponsorWalletByAppId(appId);

    if (existing) {
      return toSponsorWallet(existing);
    }

    const keypair = Ed25519Keypair.generate();
    const wallet = await this.repository.upsertSponsorWallet({
      appId,
      address: keypair.toSuiAddress(),
      encryptedSecret: encryptSecret(keypair.getSecretKey(), this.encryptionKey)
    });

    return toSponsorWallet(wallet);
  }

  async getSponsorWallet(developerId: string, appId: string) {
    await this.requireApp(developerId, appId);
    const wallet = await this.repository.findSponsorWalletByAppId(appId);

    if (!wallet) {
      throw notFound("Sponsor wallet not found");
    }

    return toSponsorWallet(wallet);
  }

  async registerProgram(developerId: string, appId: string, input: RegisterProgramInput) {
    await this.requireApp(developerId, appId);
    const payload = registerProgramSchema.parse(input);
    const program = await this.repository.upsertRegisteredProgram({
      appId,
      packageId: payload.packageId,
      appStateObjectId: payload.appStateObjectId,
      authorityCapObjectId: payload.authorityCapObjectId
    });

    return toRegisteredProgram(program);
  }

  async getRegisteredProgram(developerId: string, appId: string) {
    await this.requireApp(developerId, appId);
    const program = await this.repository.findRegisteredProgramByAppId(appId);

    if (!program) {
      throw notFound("Registered program not found");
    }

    return toRegisteredProgram(program);
  }

  async configureSayHello(developerId: string, appId: string, input: ConfigureSayHelloInput) {
    await this.requireApp(developerId, appId);
    const payload = configureSayHelloSchema.parse(input);
    const action = await this.repository.upsertManagedAction({
      appId,
      priceCredits: payload.priceCredits,
      isEnabled: payload.isEnabled
    });

    return toManagedAction(action);
  }

  private async createSessionResponse(developerId: string, email: string): Promise<DeveloperSessionResponse> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + DEVELOPER_SESSION_TTL_MS);

    await this.repository.createDeveloperSession({
      developerId,
      tokenHash: sha256(token),
      expiresAt
    });

    return {
      developer: {
        id: developerId,
        email
      },
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  private async requireApp(developerId: string, appId: string) {
    const app = await this.repository.findAppByIdForDeveloper(developerId, appId);

    if (!app) {
      throw notFound("App not found");
    }

    return app;
  }
}

let runtimeDeveloperSetupService: DeveloperSetupService | undefined;

export function createDeveloperSetupService(options: DeveloperSetupServiceOptions) {
  return new DeveloperSetupService(options);
}

export function getRuntimeDeveloperSetupService(options: Pick<DeveloperSetupServiceOptions, "apiOrigin" | "hostedAuthOrigin" | "encryptionKey">) {
  if (!runtimeDeveloperSetupService) {
    runtimeDeveloperSetupService = createDeveloperSetupService(options);
  }

  return runtimeDeveloperSetupService;
}
