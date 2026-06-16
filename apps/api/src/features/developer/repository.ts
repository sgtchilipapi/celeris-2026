import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@celeris/db";
import {
  CELERIS_CHAIN_FAMILY_SUI,
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  CELERIS_NETWORK_TESTNET
} from "@celeris/shared";

export interface DeveloperAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperSessionRecord {
  id: string;
  developerId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppRecord {
  id: string;
  developerId: string;
  name: string;
  slug: string;
  allowedChainId: string;
  authProvider: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SponsorWalletRecord {
  id: string;
  appId: string;
  chainFamily: string;
  network: string;
  address: string;
  encryptedSecret: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisteredProgramRecord {
  id: string;
  appId: string;
  chainFamily: string;
  network: string;
  packageId: string;
  appStateObjectId: string;
  authorityCapObjectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedActionRecord {
  id: string;
  appId: string;
  actionType: string;
  priceCredits: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperAppAggregateRecord {
  app: AppRecord;
  sponsorWallet: SponsorWalletRecord | null;
  registeredProgram: RegisteredProgramRecord | null;
  sayHelloAction: ManagedActionRecord | null;
}

export interface DeveloperSessionWithDeveloperRecord {
  session: DeveloperSessionRecord;
  developer: DeveloperAccountRecord;
}

export interface CreateDeveloperAccountInput {
  email: string;
  passwordHash: string;
}

export interface CreateDeveloperSessionInput {
  developerId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface CreateDeveloperAppRecordInput {
  developerId: string;
  name: string;
  slug: string;
  allowedChainId: string;
  authProvider: string;
}

export interface UpsertSponsorWalletInput {
  appId: string;
  address: string;
  encryptedSecret: string;
}

export interface UpsertRegisteredProgramInput {
  appId: string;
  packageId: string;
  appStateObjectId: string;
  authorityCapObjectId: string;
}

export interface UpsertManagedActionInput {
  appId: string;
  priceCredits: number;
  isEnabled: boolean;
}

export interface DeveloperSetupRepository {
  createDeveloperAccount(input: CreateDeveloperAccountInput): Promise<DeveloperAccountRecord>;
  findDeveloperAccountByEmail(email: string): Promise<DeveloperAccountRecord | null>;
  createDeveloperSession(input: CreateDeveloperSessionInput): Promise<DeveloperSessionRecord>;
  findDeveloperSessionByTokenHash(tokenHash: string): Promise<DeveloperSessionWithDeveloperRecord | null>;
  deleteDeveloperSessionByTokenHash(tokenHash: string): Promise<void>;
  createApp(input: CreateDeveloperAppRecordInput): Promise<DeveloperAppAggregateRecord>;
  listAppsByDeveloperId(developerId: string): Promise<DeveloperAppAggregateRecord[]>;
  findAppByIdForDeveloper(developerId: string, appId: string): Promise<DeveloperAppAggregateRecord | null>;
  upsertSponsorWallet(input: UpsertSponsorWalletInput): Promise<SponsorWalletRecord>;
  findSponsorWalletByAppId(appId: string): Promise<SponsorWalletRecord | null>;
  upsertRegisteredProgram(input: UpsertRegisteredProgramInput): Promise<RegisteredProgramRecord>;
  findRegisteredProgramByAppId(appId: string): Promise<RegisteredProgramRecord | null>;
  upsertManagedAction(input: UpsertManagedActionInput): Promise<ManagedActionRecord>;
}

function toAggregate<TApp extends AppRecord>(input: {
  app: TApp;
  sponsorWallet: SponsorWalletRecord | null;
  registeredProgram: RegisteredProgramRecord | null;
  sayHelloAction: ManagedActionRecord | null;
}): DeveloperAppAggregateRecord {
  return {
    app: input.app,
    sponsorWallet: input.sponsorWallet,
    registeredProgram: input.registeredProgram,
    sayHelloAction: input.sayHelloAction
  };
}

function extractSayHelloAction(actions: ManagedActionRecord[]) {
  return actions.find((action) => action.actionType === CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO) ?? null;
}

function fromPrismaAppAggregate(record: {
  id: string;
  developerId: string;
  name: string;
  slug: string;
  allowedChainId: string;
  authProvider: string;
  createdAt: Date;
  updatedAt: Date;
  sponsorWallets: SponsorWalletRecord[];
  registeredPrograms: RegisteredProgramRecord[];
  actions: ManagedActionRecord[];
}) {
  return toAggregate({
    app: {
      id: record.id,
      developerId: record.developerId,
      name: record.name,
      slug: record.slug,
      allowedChainId: record.allowedChainId,
      authProvider: record.authProvider,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    },
    sponsorWallet: record.sponsorWallets[0] ?? null,
    registeredProgram: record.registeredPrograms[0] ?? null,
    sayHelloAction: extractSayHelloAction(record.actions)
  });
}

export function createPrismaDeveloperSetupRepository(prisma = getPrismaClient()): DeveloperSetupRepository {
  const appInclude = {
    sponsorWallets: true,
    registeredPrograms: true,
    actions: true
  } as const;

  return {
    async createDeveloperAccount(input) {
      return prisma.developerAccount.create({
        data: input
      });
    },
    async findDeveloperAccountByEmail(email) {
      return prisma.developerAccount.findUnique({
        where: { email }
      });
    },
    async createDeveloperSession(input) {
      return prisma.developerSession.create({
        data: input
      });
    },
    async findDeveloperSessionByTokenHash(tokenHash) {
      const record = await prisma.developerSession.findUnique({
        where: { tokenHash },
        include: {
          developer: true
        }
      });

      if (!record) {
        return null;
      }

      return {
        session: {
          id: record.id,
          developerId: record.developerId,
          tokenHash: record.tokenHash,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        },
        developer: record.developer
      };
    },
    async deleteDeveloperSessionByTokenHash(tokenHash) {
      await prisma.developerSession.deleteMany({
        where: { tokenHash }
      });
    },
    async createApp(input) {
      const record = await prisma.app.create({
        data: input,
        include: appInclude
      });

      return fromPrismaAppAggregate(record);
    },
    async listAppsByDeveloperId(developerId) {
      const records = await prisma.app.findMany({
        where: { developerId },
        orderBy: { createdAt: "asc" },
        include: appInclude
      });

      return records.map(fromPrismaAppAggregate);
    },
    async findAppByIdForDeveloper(developerId, appId) {
      const record = await prisma.app.findFirst({
        where: {
          id: appId,
          developerId
        },
        include: appInclude
      });

      return record ? fromPrismaAppAggregate(record) : null;
    },
    async upsertSponsorWallet(input) {
      return prisma.sponsorWallet.upsert({
        where: {
          appId_chainFamily_network: {
            appId: input.appId,
            chainFamily: CELERIS_CHAIN_FAMILY_SUI,
            network: CELERIS_NETWORK_TESTNET
          }
        },
        update: {
          address: input.address,
          encryptedSecret: input.encryptedSecret
        },
        create: {
          appId: input.appId,
          chainFamily: CELERIS_CHAIN_FAMILY_SUI,
          network: CELERIS_NETWORK_TESTNET,
          address: input.address,
          encryptedSecret: input.encryptedSecret
        }
      });
    },
    async findSponsorWalletByAppId(appId) {
      return prisma.sponsorWallet.findUnique({
        where: {
          appId_chainFamily_network: {
            appId,
            chainFamily: CELERIS_CHAIN_FAMILY_SUI,
            network: CELERIS_NETWORK_TESTNET
          }
        }
      });
    },
    async upsertRegisteredProgram(input) {
      return prisma.registeredProgram.upsert({
        where: {
          appId_chainFamily_network: {
            appId: input.appId,
            chainFamily: CELERIS_CHAIN_FAMILY_SUI,
            network: CELERIS_NETWORK_TESTNET
          }
        },
        update: {
          packageId: input.packageId,
          appStateObjectId: input.appStateObjectId,
          authorityCapObjectId: input.authorityCapObjectId
        },
        create: {
          appId: input.appId,
          chainFamily: CELERIS_CHAIN_FAMILY_SUI,
          network: CELERIS_NETWORK_TESTNET,
          packageId: input.packageId,
          appStateObjectId: input.appStateObjectId,
          authorityCapObjectId: input.authorityCapObjectId
        }
      });
    },
    async findRegisteredProgramByAppId(appId) {
      return prisma.registeredProgram.findUnique({
        where: {
          appId_chainFamily_network: {
            appId,
            chainFamily: CELERIS_CHAIN_FAMILY_SUI,
            network: CELERIS_NETWORK_TESTNET
          }
        }
      });
    },
    async upsertManagedAction(input) {
      return prisma.managedAction.upsert({
        where: {
          appId_actionType: {
            appId: input.appId,
            actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO
          }
        },
        update: {
          priceCredits: input.priceCredits,
          isEnabled: input.isEnabled
        },
        create: {
          appId: input.appId,
          actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
          priceCredits: input.priceCredits,
          isEnabled: input.isEnabled
        }
      });
    }
  };
}

export function createInMemoryDeveloperSetupRepository(): DeveloperSetupRepository {
  const developers = new Map<string, DeveloperAccountRecord>();
  const developersByEmail = new Map<string, DeveloperAccountRecord>();
  const sessionsByTokenHash = new Map<string, DeveloperSessionRecord>();
  const apps = new Map<string, AppRecord>();
  const sponsorWalletsByAppId = new Map<string, SponsorWalletRecord>();
  const programsByAppId = new Map<string, RegisteredProgramRecord>();
  const actionsByAppId = new Map<string, ManagedActionRecord>();

  function makeId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getAggregate(app: AppRecord): DeveloperAppAggregateRecord {
    return {
      app,
      sponsorWallet: sponsorWalletsByAppId.get(app.id) ?? null,
      registeredProgram: programsByAppId.get(app.id) ?? null,
      sayHelloAction: actionsByAppId.get(app.id) ?? null
    };
  }

  return {
    async createDeveloperAccount(input) {
      const now = new Date();
      const record: DeveloperAccountRecord = {
        id: makeId("dev"),
        email: input.email,
        passwordHash: input.passwordHash,
        createdAt: now,
        updatedAt: now
      };

      developers.set(record.id, record);
      developersByEmail.set(record.email, record);
      return record;
    },
    async findDeveloperAccountByEmail(email) {
      return developersByEmail.get(email) ?? null;
    },
    async createDeveloperSession(input) {
      const now = new Date();
      const record: DeveloperSessionRecord = {
        id: makeId("ds"),
        developerId: input.developerId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now
      };

      sessionsByTokenHash.set(record.tokenHash, record);
      return record;
    },
    async findDeveloperSessionByTokenHash(tokenHash) {
      const session = sessionsByTokenHash.get(tokenHash);

      if (!session) {
        return null;
      }

      const developer = developers.get(session.developerId);

      if (!developer) {
        return null;
      }

      return {
        session,
        developer
      };
    },
    async deleteDeveloperSessionByTokenHash(tokenHash) {
      sessionsByTokenHash.delete(tokenHash);
    },
    async createApp(input) {
      const now = new Date();
      const app: AppRecord = {
        id: makeId("app"),
        developerId: input.developerId,
        name: input.name,
        slug: input.slug,
        allowedChainId: input.allowedChainId,
        authProvider: input.authProvider,
        createdAt: now,
        updatedAt: now
      };

      apps.set(app.id, app);
      return getAggregate(app);
    },
    async listAppsByDeveloperId(developerId) {
      return Array.from(apps.values())
        .filter((app) => app.developerId === developerId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(getAggregate);
    },
    async findAppByIdForDeveloper(developerId, appId) {
      const app = apps.get(appId);

      if (!app || app.developerId !== developerId) {
        return null;
      }

      return getAggregate(app);
    },
    async upsertSponsorWallet(input) {
      const existing = sponsorWalletsByAppId.get(input.appId);
      const now = new Date();
      const record: SponsorWalletRecord = {
        id: existing?.id ?? makeId("wallet"),
        appId: input.appId,
        chainFamily: CELERIS_CHAIN_FAMILY_SUI,
        network: CELERIS_NETWORK_TESTNET,
        address: input.address,
        encryptedSecret: input.encryptedSecret,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      sponsorWalletsByAppId.set(input.appId, record);
      return record;
    },
    async findSponsorWalletByAppId(appId) {
      return sponsorWalletsByAppId.get(appId) ?? null;
    },
    async upsertRegisteredProgram(input) {
      const existing = programsByAppId.get(input.appId);
      const now = new Date();
      const record: RegisteredProgramRecord = {
        id: existing?.id ?? makeId("program"),
        appId: input.appId,
        chainFamily: CELERIS_CHAIN_FAMILY_SUI,
        network: CELERIS_NETWORK_TESTNET,
        packageId: input.packageId,
        appStateObjectId: input.appStateObjectId,
        authorityCapObjectId: input.authorityCapObjectId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      programsByAppId.set(input.appId, record);
      return record;
    },
    async findRegisteredProgramByAppId(appId) {
      return programsByAppId.get(appId) ?? null;
    },
    async upsertManagedAction(input) {
      const existing = actionsByAppId.get(input.appId);
      const now = new Date();
      const record: ManagedActionRecord = {
        id: existing?.id ?? makeId("action"),
        appId: input.appId,
        actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
        priceCredits: input.priceCredits,
        isEnabled: input.isEnabled,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      actionsByAppId.set(input.appId, record);
      return record;
    }
  };
}
