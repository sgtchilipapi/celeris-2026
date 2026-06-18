import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@celeris/db";
import {
  CELERIS_CHAIN_FAMILY_SUI,
  CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
  CELERIS_NETWORK_TESTNET
} from "@celeris/shared";

export interface UserIdentityRecord {
  id: string;
  issuer: string;
  subject: string;
  email: string;
  displayName: string | null;
  salt: string;
  walletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperProfileRecord {
  id: string;
  userIdentityId: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthLoginRequestRecord {
  id: string;
  clientKind: string;
  clientId: string;
  appId: string | null;
  state: string;
  oauthState: string | null;
  redirectUri: string;
  nonce: string | null;
  extendedEphemeralPublicKey: string | null;
  maxEpoch: number | null;
  jwtRandomness: string | null;
  zkLoginProofInputsJson: string | null;
  status: string;
  authCode: string | null;
  userIdentityId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSessionRecord {
  id: string;
  userIdentityId: string;
  clientKind: string;
  clientId: string;
  appId: string | null;
  walletAddress: string;
  chainId: string;
  tokenHash: string;
  zkLoginProofInputsJson: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppRecord {
  id: string;
  developerId: string | null;
  developerProfileId: string | null;
  name: string;
  slug: string;
  allowedChainId: string;
  authProvider: string;
  creditsPerUsd: number;
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

export interface CheckoutSessionRecord {
  id: string;
  appId: string;
  walletAddress: string;
  chainId: string;
  usdAmount: number;
  creditsPerUsd: number;
  credits: number;
  status: string;
  successRedirectUrl: string;
  cancelRedirectUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingActionReservationRecord {
  id: string;
  appId: string;
  walletAddress: string;
  chainId: string;
  actionType: string;
  status: string;
  username: string;
  message: string;
  creditsReserved: number;
  transactionBytes: string;
  sponsorSignature: string;
  sponsorAddress: string;
  expiresAt: Date;
  submittedDigest: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SponsorGasCoinLockRecord {
  id: string;
  appId: string;
  reservationId: string;
  objectId: string;
  version: string;
  digest: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionRecordRecord {
  id: string;
  appId: string;
  walletAddress: string;
  chainId: string;
  actionType: string;
  username: string;
  message: string;
  digest: string;
  explorerUrl: string;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeveloperAppAggregateRecord {
  app: AppRecord;
  sponsorWallet: SponsorWalletRecord | null;
  registeredProgram: RegisteredProgramRecord | null;
  sayHelloAction: ManagedActionRecord | null;
}

export interface UserSessionAggregateRecord {
  session: UserSessionRecord;
  userIdentity: UserIdentityRecord;
  developerProfile: DeveloperProfileRecord | null;
}

export interface CreateUserIdentityInput {
  issuer: string;
  subject: string;
  email: string;
  displayName?: string | null;
  salt: string;
  walletAddress: string;
}

export interface UpdateUserIdentityZkLoginInput {
  id: string;
  salt: string;
  walletAddress: string;
}

export interface UpsertDeveloperProfileInput {
  userIdentityId: string;
  email: string;
  displayName?: string | null;
}

export interface CreateAuthLoginRequestInput {
  clientKind: string;
  clientId: string;
  appId?: string | null;
  state: string;
  oauthState: string;
  redirectUri: string;
  nonce?: string | null;
  extendedEphemeralPublicKey?: string | null;
  maxEpoch?: number | null;
  jwtRandomness?: string | null;
  expiresAt: Date;
}

export interface CompleteAuthLoginRequestInput {
  loginRequestId: string;
  authCode: string;
  userIdentityId: string;
  zkLoginProofInputsJson?: string | null;
}

export interface CreateUserSessionInput {
  userIdentityId: string;
  clientKind: string;
  clientId: string;
  appId?: string | null;
  walletAddress: string;
  chainId: string;
  tokenHash: string;
  zkLoginProofInputsJson?: string | null;
  expiresAt: Date;
}

export interface CreateDeveloperAppRecordInput {
  developerProfileId: string;
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

export interface UpdateAppCreditsPricingInput {
  appId: string;
  creditsPerUsd: number;
}

export interface CreateCheckoutSessionRecordInput {
  appId: string;
  walletAddress: string;
  chainId: string;
  usdAmount: number;
  creditsPerUsd: number;
  credits: number;
  successRedirectUrl: string;
  cancelRedirectUrl: string;
}

export interface CompleteCheckoutSessionRecordInput {
  appId: string;
  walletAddress: string;
  checkoutSessionId: string;
}

export interface SponsorGasCoinRefInput {
  objectId: string;
  version: string;
  digest: string;
}

export interface CreatePendingActionReservationInput {
  appId: string;
  walletAddress: string;
  chainId: string;
  username: string;
  message: string;
  creditsReserved: number;
  transactionBytes: string;
  sponsorSignature: string;
  sponsorAddress: string;
  gasCoin: SponsorGasCoinRefInput;
  expiresAt: Date;
}

export interface CompletePendingActionReservationInput {
  appId: string;
  walletAddress: string;
  reservationId: string;
  outcome: "submitted" | "failed";
  digest?: string;
  explorerUrl?: string;
  verifiedAt?: Date;
}

export interface DeveloperSetupRepository {
  findUserIdentityById(id: string): Promise<UserIdentityRecord | null>;
  findUserIdentityByIssuerSubject(issuer: string, subject: string): Promise<UserIdentityRecord | null>;
  createUserIdentity(input: CreateUserIdentityInput): Promise<UserIdentityRecord>;
  updateUserIdentityZkLogin(input: UpdateUserIdentityZkLoginInput): Promise<UserIdentityRecord>;
  upsertDeveloperProfile(input: UpsertDeveloperProfileInput): Promise<DeveloperProfileRecord>;
  findDeveloperProfileById(id: string): Promise<DeveloperProfileRecord | null>;
  createAuthLoginRequest(input: CreateAuthLoginRequestInput): Promise<AuthLoginRequestRecord>;
  findAuthLoginRequestById(id: string): Promise<AuthLoginRequestRecord | null>;
  findAuthLoginRequestByOAuthState(oauthState: string): Promise<AuthLoginRequestRecord | null>;
  findAuthLoginRequestByAuthCode(authCode: string): Promise<AuthLoginRequestRecord | null>;
  completeAuthLoginRequest(input: CompleteAuthLoginRequestInput): Promise<AuthLoginRequestRecord>;
  createUserSession(input: CreateUserSessionInput): Promise<UserSessionRecord>;
  findUserSessionByTokenHash(tokenHash: string): Promise<UserSessionAggregateRecord | null>;
  deleteUserSessionByTokenHash(tokenHash: string): Promise<void>;
  createApp(input: CreateDeveloperAppRecordInput): Promise<DeveloperAppAggregateRecord>;
  findAppById(appId: string): Promise<DeveloperAppAggregateRecord | null>;
  listAppsByDeveloperProfileId(developerProfileId: string): Promise<DeveloperAppAggregateRecord[]>;
  findAppByIdForDeveloperProfile(developerProfileId: string, appId: string): Promise<DeveloperAppAggregateRecord | null>;
  upsertSponsorWallet(input: UpsertSponsorWalletInput): Promise<SponsorWalletRecord>;
  findSponsorWalletByAppId(appId: string): Promise<SponsorWalletRecord | null>;
  upsertRegisteredProgram(input: UpsertRegisteredProgramInput): Promise<RegisteredProgramRecord>;
  findRegisteredProgramByAppId(appId: string): Promise<RegisteredProgramRecord | null>;
  upsertManagedAction(input: UpsertManagedActionInput): Promise<ManagedActionRecord>;
  updateAppCreditsPricing(input: UpdateAppCreditsPricingInput): Promise<DeveloperAppAggregateRecord | null>;
  createCheckoutSession(input: CreateCheckoutSessionRecordInput): Promise<CheckoutSessionRecord>;
  findCheckoutSessionById(appId: string, checkoutSessionId: string): Promise<CheckoutSessionRecord | null>;
  completeCheckoutSession(input: CompleteCheckoutSessionRecordInput): Promise<CheckoutSessionRecord | null>;
  getCreditBalance(appId: string, walletAddress: string): Promise<number>;
  createPendingActionReservation(input: CreatePendingActionReservationInput): Promise<PendingActionReservationRecord | null>;
  findPendingActionReservationById(appId: string, reservationId: string): Promise<PendingActionReservationRecord | null>;
  completePendingActionReservation(input: CompletePendingActionReservationInput): Promise<{
    reservation: PendingActionReservationRecord;
    transaction: TransactionRecordRecord | null;
  } | null>;
  listTransactions(appId: string): Promise<TransactionRecordRecord[]>;
}

function extractSayHelloAction(actions: ManagedActionRecord[]) {
  return actions.find((action) => action.actionType === CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO) ?? null;
}

function fromPrismaAppAggregate(record: {
  id: string;
  developerId: string | null;
  developerProfileId: string | null;
  name: string;
  slug: string;
  allowedChainId: string;
  authProvider: string;
  creditsPerUsd: number;
  createdAt: Date;
  updatedAt: Date;
  sponsorWallets: SponsorWalletRecord[];
  registeredPrograms: RegisteredProgramRecord[];
  actions: ManagedActionRecord[];
}): DeveloperAppAggregateRecord {
  return {
    app: {
      id: record.id,
      developerId: record.developerId,
      developerProfileId: record.developerProfileId,
      name: record.name,
      slug: record.slug,
      allowedChainId: record.allowedChainId,
      authProvider: record.authProvider,
      creditsPerUsd: record.creditsPerUsd,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    },
    sponsorWallet: record.sponsorWallets[0] ?? null,
    registeredProgram: record.registeredPrograms[0] ?? null,
    sayHelloAction: extractSayHelloAction(record.actions)
  };
}

export function createPrismaDeveloperSetupRepository(prisma = getPrismaClient()): DeveloperSetupRepository {
  const appInclude = {
    sponsorWallets: true,
    registeredPrograms: true,
    actions: true
  } as const;

  return {
    async findUserIdentityById(id) {
      return prisma.userIdentity.findUnique({
        where: { id }
      });
    },
    async findUserIdentityByIssuerSubject(issuer, subject) {
      return prisma.userIdentity.findUnique({
        where: {
          issuer_subject: {
            issuer,
            subject
          }
        }
      });
    },
    async createUserIdentity(input) {
      return prisma.userIdentity.create({
        data: input
      });
    },
    async updateUserIdentityZkLogin(input) {
      return prisma.userIdentity.update({
        where: {
          id: input.id
        },
        data: {
          salt: input.salt,
          walletAddress: input.walletAddress
        }
      });
    },
    async upsertDeveloperProfile(input) {
      return prisma.developerProfile.upsert({
        where: {
          userIdentityId: input.userIdentityId
        },
        update: {
          email: input.email,
          displayName: input.displayName ?? null
        },
        create: {
          userIdentityId: input.userIdentityId,
          email: input.email,
          displayName: input.displayName ?? null
        }
      });
    },
    async findDeveloperProfileById(id) {
      return prisma.developerProfile.findUnique({
        where: { id }
      });
    },
    async createAuthLoginRequest(input) {
      return prisma.authLoginRequest.create({
        data: {
          clientKind: input.clientKind,
          clientId: input.clientId,
          appId: input.appId ?? null,
          state: input.state,
          oauthState: input.oauthState,
          redirectUri: input.redirectUri,
          nonce: input.nonce ?? null,
          extendedEphemeralPublicKey: input.extendedEphemeralPublicKey ?? null,
          maxEpoch: input.maxEpoch ?? null,
          jwtRandomness: input.jwtRandomness ?? null,
          zkLoginProofInputsJson: null,
          status: "pending",
          expiresAt: input.expiresAt
        }
      });
    },
    async findAuthLoginRequestById(id) {
      return prisma.authLoginRequest.findUnique({
        where: { id }
      });
    },
    async findAuthLoginRequestByOAuthState(oauthState) {
      return prisma.authLoginRequest.findUnique({
        where: { oauthState }
      });
    },
    async findAuthLoginRequestByAuthCode(authCode) {
      return prisma.authLoginRequest.findUnique({
        where: { authCode }
      });
    },
    async completeAuthLoginRequest(input) {
      return prisma.authLoginRequest.update({
        where: { id: input.loginRequestId },
        data: {
          status: "completed",
          authCode: input.authCode,
          userIdentityId: input.userIdentityId,
          zkLoginProofInputsJson: input.zkLoginProofInputsJson ?? null
        }
      });
    },
    async createUserSession(input) {
      return prisma.userSession.create({
        data: {
          userIdentityId: input.userIdentityId,
          clientKind: input.clientKind,
          clientId: input.clientId,
          appId: input.appId ?? null,
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          tokenHash: input.tokenHash,
          zkLoginProofInputsJson: input.zkLoginProofInputsJson ?? null,
          expiresAt: input.expiresAt
        }
      });
    },
    async findUserSessionByTokenHash(tokenHash) {
      const record = await prisma.userSession.findUnique({
        where: { tokenHash },
        include: {
          userIdentity: {
            include: {
              developerProfile: true
            }
          }
        }
      });

      if (!record) {
        return null;
      }

      return {
        session: {
          id: record.id,
          userIdentityId: record.userIdentityId,
          clientKind: record.clientKind,
          clientId: record.clientId,
          appId: record.appId,
          walletAddress: record.walletAddress,
          chainId: record.chainId,
          tokenHash: record.tokenHash,
          zkLoginProofInputsJson: record.zkLoginProofInputsJson,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        },
        userIdentity: {
          id: record.userIdentity.id,
          issuer: record.userIdentity.issuer,
          subject: record.userIdentity.subject,
          email: record.userIdentity.email,
          displayName: record.userIdentity.displayName,
          salt: record.userIdentity.salt,
          walletAddress: record.userIdentity.walletAddress,
          createdAt: record.userIdentity.createdAt,
          updatedAt: record.userIdentity.updatedAt
        },
        developerProfile: record.userIdentity.developerProfile
      };
    },
    async deleteUserSessionByTokenHash(tokenHash) {
      await prisma.userSession.deleteMany({
        where: { tokenHash }
      });
    },
    async createApp(input) {
      const record = await prisma.app.create({
        data: {
          developerProfileId: input.developerProfileId,
          name: input.name,
          slug: input.slug,
          allowedChainId: input.allowedChainId,
          authProvider: input.authProvider
        },
        include: appInclude
      });

      return fromPrismaAppAggregate(record);
    },
    async findAppById(appId) {
      const record = await prisma.app.findUnique({
        where: { id: appId },
        include: appInclude
      });

      return record ? fromPrismaAppAggregate(record) : null;
    },
    async listAppsByDeveloperProfileId(developerProfileId) {
      const records = await prisma.app.findMany({
        where: { developerProfileId },
        orderBy: { createdAt: "asc" },
        include: appInclude
      });

      return records.map(fromPrismaAppAggregate);
    },
    async findAppByIdForDeveloperProfile(developerProfileId, appId) {
      const record = await prisma.app.findFirst({
        where: {
          id: appId,
          developerProfileId
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
    },
    async updateAppCreditsPricing(input) {
      const record = await prisma.app.update({
        where: { id: input.appId },
        data: {
          creditsPerUsd: input.creditsPerUsd
        },
        include: appInclude
      });

      return fromPrismaAppAggregate(record);
    },
    async createCheckoutSession(input) {
      return prisma.checkoutSession.create({
        data: {
          appId: input.appId,
          walletAddress: input.walletAddress,
          chainId: input.chainId,
          usdAmount: input.usdAmount,
          creditsPerUsd: input.creditsPerUsd,
          credits: input.credits,
          status: "pending",
          successRedirectUrl: input.successRedirectUrl,
          cancelRedirectUrl: input.cancelRedirectUrl
        }
      });
    },
    async findCheckoutSessionById(appId, checkoutSessionId) {
      return prisma.checkoutSession.findFirst({
        where: {
          id: checkoutSessionId,
          appId
        }
      });
    },
    async completeCheckoutSession(input) {
      return prisma.$transaction(async (tx) => {
        const checkoutSession = await tx.checkoutSession.findFirst({
          where: {
            id: input.checkoutSessionId,
            appId: input.appId,
            walletAddress: input.walletAddress
          }
        });

        if (!checkoutSession) {
          return null;
        }

        const completed =
          checkoutSession.status === "completed"
            ? checkoutSession
            : await tx.checkoutSession.update({
                where: { id: checkoutSession.id },
                data: { status: "completed" }
              });

        await tx.creditLedgerEntry.upsert({
          where: {
            appId_referenceType_referenceId_reason: {
              appId: checkoutSession.appId,
              referenceType: "checkout_session",
              referenceId: checkoutSession.id,
              reason: "purchase"
            }
          },
          update: {},
          create: {
            appId: checkoutSession.appId,
            walletAddress: checkoutSession.walletAddress,
            chainId: checkoutSession.chainId,
            deltaCredits: checkoutSession.credits,
            reason: "purchase",
            referenceType: "checkout_session",
            referenceId: checkoutSession.id
          }
        });

        return completed;
      });
    },
    async getCreditBalance(appId, walletAddress) {
      const aggregate = await prisma.creditLedgerEntry.aggregate({
        where: {
          appId,
          walletAddress
        },
        _sum: {
          deltaCredits: true
        }
      });

      return aggregate._sum.deltaCredits ?? 0;
    },
    async createPendingActionReservation(input) {
      return prisma.$transaction(async (tx) => {
        const balance = await tx.creditLedgerEntry.aggregate({
          where: {
            appId: input.appId,
            walletAddress: input.walletAddress
          },
          _sum: {
            deltaCredits: true
          }
        });

        if ((balance._sum.deltaCredits ?? 0) < input.creditsReserved) {
          return null;
        }

        const reservation = await tx.pendingActionReservation.create({
          data: {
            appId: input.appId,
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
            status: "reserved",
            username: input.username,
            message: input.message,
            creditsReserved: input.creditsReserved,
            transactionBytes: input.transactionBytes,
            sponsorSignature: input.sponsorSignature,
            sponsorAddress: input.sponsorAddress,
            expiresAt: input.expiresAt
          }
        });

        await tx.sponsorGasCoinLock.create({
          data: {
            appId: input.appId,
            reservationId: reservation.id,
            objectId: input.gasCoin.objectId,
            version: input.gasCoin.version,
            digest: input.gasCoin.digest,
            status: "locked",
            expiresAt: input.expiresAt
          }
        });

        await tx.creditLedgerEntry.create({
          data: {
            appId: input.appId,
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            deltaCredits: -input.creditsReserved,
            reason: "reserve",
            referenceType: "action_reservation",
            referenceId: reservation.id
          }
        });

        return reservation;
      });
    },
    async findPendingActionReservationById(appId, reservationId) {
      return prisma.pendingActionReservation.findFirst({
        where: {
          id: reservationId,
          appId
        }
      });
    },
    async completePendingActionReservation(input) {
      return prisma.$transaction(async (tx) => {
        const reservation = await tx.pendingActionReservation.findFirst({
          where: {
            id: input.reservationId,
            appId: input.appId,
            walletAddress: input.walletAddress
          }
        });

        if (!reservation) {
          return null;
        }

        if (reservation.status === "captured" || reservation.status === "released") {
          const transaction = input.digest
            ? await tx.transactionRecord.findUnique({
                where: {
                  appId_digest: {
                    appId: input.appId,
                    digest: input.digest
                  }
                }
              })
            : null;
          return { reservation, transaction };
        }

        if (input.outcome === "failed") {
          const released = await tx.pendingActionReservation.update({
            where: { id: reservation.id },
            data: {
              status: "released"
            }
          });
          await tx.sponsorGasCoinLock.updateMany({
            where: { reservationId: reservation.id },
            data: { status: "released" }
          });
          await tx.creditLedgerEntry.upsert({
            where: {
              appId_referenceType_referenceId_reason: {
                appId: input.appId,
                referenceType: "action_reservation",
                referenceId: reservation.id,
                reason: "release"
              }
            },
            update: {},
            create: {
              appId: input.appId,
              walletAddress: input.walletAddress,
              chainId: reservation.chainId,
              deltaCredits: reservation.creditsReserved,
              reason: "release",
              referenceType: "action_reservation",
              referenceId: reservation.id
            }
          });
          return { reservation: released, transaction: null };
        }

        if (!input.digest || !input.explorerUrl || !input.verifiedAt) {
          throw new Error("Submitted reservations require digest verification details");
        }

        const captured = await tx.pendingActionReservation.update({
          where: { id: reservation.id },
          data: {
            status: "captured",
            submittedDigest: input.digest
          }
        });
        await tx.sponsorGasCoinLock.updateMany({
          where: { reservationId: reservation.id },
          data: { status: "spent" }
        });
        await tx.creditLedgerEntry.upsert({
          where: {
            appId_referenceType_referenceId_reason: {
              appId: input.appId,
              referenceType: "action_reservation",
              referenceId: reservation.id,
              reason: "capture"
            }
          },
          update: {},
          create: {
            appId: input.appId,
            walletAddress: input.walletAddress,
            chainId: reservation.chainId,
            deltaCredits: 0,
            reason: "capture",
            referenceType: "action_reservation",
            referenceId: reservation.id
          }
        });
        const transaction = await tx.transactionRecord.upsert({
          where: {
            appId_digest: {
              appId: input.appId,
              digest: input.digest
            }
          },
          update: {
            status: "confirmed",
            confirmedAt: input.verifiedAt
          },
          create: {
            appId: input.appId,
            walletAddress: input.walletAddress,
            chainId: reservation.chainId,
            actionType: reservation.actionType,
            username: reservation.username,
            message: reservation.message,
            digest: input.digest,
            explorerUrl: input.explorerUrl,
            status: "confirmed",
            confirmedAt: input.verifiedAt
          }
        });

        return { reservation: captured, transaction };
      });
    },
    async listTransactions(appId) {
      return prisma.transactionRecord.findMany({
        where: { appId },
        orderBy: { createdAt: "desc" },
        take: 50
      });
    }
  };
}

export function createInMemoryDeveloperSetupRepository(): DeveloperSetupRepository {
  const userIdentities = new Map<string, UserIdentityRecord>();
  const userIdentityKeys = new Map<string, string>();
  const developerProfilesByIdentityId = new Map<string, DeveloperProfileRecord>();
  const authLoginRequests = new Map<string, AuthLoginRequestRecord>();
  const authLoginRequestOAuthStates = new Map<string, string>();
  const authLoginRequestCodes = new Map<string, string>();
  const sessionsByTokenHash = new Map<string, UserSessionRecord>();
  const apps = new Map<string, AppRecord>();
  const sponsorWalletsByAppId = new Map<string, SponsorWalletRecord>();
  const programsByAppId = new Map<string, RegisteredProgramRecord>();
  const actionsByAppId = new Map<string, ManagedActionRecord>();
  const checkoutSessions = new Map<string, CheckoutSessionRecord>();
  const pendingActionReservations = new Map<string, PendingActionReservationRecord>();
  const transactionRecords = new Map<string, TransactionRecordRecord>();
  const ledgerEntriesByReference = new Map<
    string,
    {
      appId: string;
      walletAddress: string;
      deltaCredits: number;
    }
  >();

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
    async findUserIdentityById(id) {
      return userIdentities.get(id) ?? null;
    },
    async findUserIdentityByIssuerSubject(issuer, subject) {
      const id = userIdentityKeys.get(`${issuer}:${subject}`);
      return id ? userIdentities.get(id) ?? null : null;
    },
    async createUserIdentity(input) {
      const now = new Date();
      const record: UserIdentityRecord = {
        id: makeId("user"),
        issuer: input.issuer,
        subject: input.subject,
        email: input.email,
        displayName: input.displayName ?? null,
        salt: input.salt,
        walletAddress: input.walletAddress,
        createdAt: now,
        updatedAt: now
      };

      userIdentities.set(record.id, record);
      userIdentityKeys.set(`${record.issuer}:${record.subject}`, record.id);
      return record;
    },
    async updateUserIdentityZkLogin(input) {
      const existing = userIdentities.get(input.id);

      if (!existing) {
        throw new Error("User identity not found");
      }

      const updated = {
        ...existing,
        salt: input.salt,
        walletAddress: input.walletAddress,
        updatedAt: new Date()
      };
      userIdentities.set(updated.id, updated);
      return updated;
    },
    async upsertDeveloperProfile(input) {
      const existing = developerProfilesByIdentityId.get(input.userIdentityId);
      const now = new Date();
      const record: DeveloperProfileRecord = {
        id: existing?.id ?? makeId("profile"),
        userIdentityId: input.userIdentityId,
        email: input.email,
        displayName: input.displayName ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      developerProfilesByIdentityId.set(record.userIdentityId, record);
      return record;
    },
    async findDeveloperProfileById(id) {
      for (const profile of developerProfilesByIdentityId.values()) {
        if (profile.id === id) {
          return profile;
        }
      }
      return null;
    },
    async createAuthLoginRequest(input) {
      const now = new Date();
      const record: AuthLoginRequestRecord = {
        id: makeId("login"),
        clientKind: input.clientKind,
        clientId: input.clientId,
        appId: input.appId ?? null,
        state: input.state,
        oauthState: input.oauthState,
        redirectUri: input.redirectUri,
        nonce: input.nonce ?? null,
        extendedEphemeralPublicKey: input.extendedEphemeralPublicKey ?? null,
        maxEpoch: input.maxEpoch ?? null,
        jwtRandomness: input.jwtRandomness ?? null,
        zkLoginProofInputsJson: null,
        status: "pending",
        authCode: null,
        userIdentityId: null,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now
      };

      authLoginRequests.set(record.id, record);
      authLoginRequestOAuthStates.set(record.oauthState ?? "", record.id);
      return record;
    },
    async findAuthLoginRequestById(id) {
      return authLoginRequests.get(id) ?? null;
    },
    async findAuthLoginRequestByOAuthState(oauthState) {
      const id = authLoginRequestOAuthStates.get(oauthState);
      return id ? authLoginRequests.get(id) ?? null : null;
    },
    async findAuthLoginRequestByAuthCode(authCode) {
      const id = authLoginRequestCodes.get(authCode);
      return id ? authLoginRequests.get(id) ?? null : null;
    },
    async completeAuthLoginRequest(input) {
      const existing = authLoginRequests.get(input.loginRequestId);

      if (!existing) {
        throw new Error("Unknown login request");
      }

      const record: AuthLoginRequestRecord = {
        ...existing,
        status: "completed",
        authCode: input.authCode,
        userIdentityId: input.userIdentityId,
        zkLoginProofInputsJson: input.zkLoginProofInputsJson ?? null,
        updatedAt: new Date()
      };

      authLoginRequests.set(record.id, record);
      authLoginRequestCodes.set(input.authCode, record.id);
      return record;
    },
    async createUserSession(input) {
      const now = new Date();
      const record: UserSessionRecord = {
        id: makeId("session"),
        userIdentityId: input.userIdentityId,
        clientKind: input.clientKind,
        clientId: input.clientId,
        appId: input.appId ?? null,
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        tokenHash: input.tokenHash,
        zkLoginProofInputsJson: input.zkLoginProofInputsJson ?? null,
        expiresAt: input.expiresAt,
        createdAt: now,
        updatedAt: now
      };

      sessionsByTokenHash.set(record.tokenHash, record);
      return record;
    },
    async findUserSessionByTokenHash(tokenHash) {
      const session = sessionsByTokenHash.get(tokenHash);
      if (!session) {
        return null;
      }

      const userIdentity = userIdentities.get(session.userIdentityId);
      if (!userIdentity) {
        return null;
      }

      return {
        session,
        userIdentity,
        developerProfile: developerProfilesByIdentityId.get(userIdentity.id) ?? null
      };
    },
    async deleteUserSessionByTokenHash(tokenHash) {
      sessionsByTokenHash.delete(tokenHash);
    },
    async createApp(input) {
      const now = new Date();
      const app: AppRecord = {
        id: makeId("app"),
        developerId: null,
        developerProfileId: input.developerProfileId,
        name: input.name,
        slug: input.slug,
        allowedChainId: input.allowedChainId,
        authProvider: input.authProvider,
        creditsPerUsd: 100,
        createdAt: now,
        updatedAt: now
      };

      apps.set(app.id, app);
      return getAggregate(app);
    },
    async findAppById(appId) {
      const app = apps.get(appId);
      return app ? getAggregate(app) : null;
    },
    async listAppsByDeveloperProfileId(developerProfileId) {
      return Array.from(apps.values())
        .filter((app) => app.developerProfileId === developerProfileId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(getAggregate);
    },
    async findAppByIdForDeveloperProfile(developerProfileId, appId) {
      const app = apps.get(appId);

      if (!app || app.developerProfileId !== developerProfileId) {
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
    },
    async updateAppCreditsPricing(input) {
      const existing = apps.get(input.appId);

      if (!existing) {
        return null;
      }

      const updated: AppRecord = {
        ...existing,
        creditsPerUsd: input.creditsPerUsd,
        updatedAt: new Date()
      };

      apps.set(input.appId, updated);
      return getAggregate(updated);
    },
    async createCheckoutSession(input) {
      const now = new Date();
      const record: CheckoutSessionRecord = {
        id: makeId("checkout"),
        appId: input.appId,
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        usdAmount: input.usdAmount,
        creditsPerUsd: input.creditsPerUsd,
        credits: input.credits,
        status: "pending",
        successRedirectUrl: input.successRedirectUrl,
        cancelRedirectUrl: input.cancelRedirectUrl,
        createdAt: now,
        updatedAt: now
      };

      checkoutSessions.set(record.id, record);
      return record;
    },
    async findCheckoutSessionById(appId, checkoutSessionId) {
      const record = checkoutSessions.get(checkoutSessionId);
      return record?.appId === appId ? record : null;
    },
    async completeCheckoutSession(input) {
      const existing = checkoutSessions.get(input.checkoutSessionId);

      if (!existing || existing.appId !== input.appId || existing.walletAddress !== input.walletAddress) {
        return null;
      }

      const completed: CheckoutSessionRecord = {
        ...existing,
        status: "completed",
        updatedAt: new Date()
      };
      checkoutSessions.set(completed.id, completed);

      const ledgerKey = `${completed.appId}:checkout_session:${completed.id}:purchase`;
      if (!ledgerEntriesByReference.has(ledgerKey)) {
        ledgerEntriesByReference.set(ledgerKey, {
          appId: completed.appId,
          walletAddress: completed.walletAddress,
          deltaCredits: completed.credits
        });
      }

      return completed;
    },
    async getCreditBalance(appId, walletAddress) {
      let balance = 0;

      for (const entry of ledgerEntriesByReference.values()) {
        if (entry.appId === appId && entry.walletAddress === walletAddress) {
          balance += entry.deltaCredits;
        }
      }

      return balance;
    },
    async createPendingActionReservation(input) {
      let balance = 0;
      for (const entry of ledgerEntriesByReference.values()) {
        if (entry.appId === input.appId && entry.walletAddress === input.walletAddress) {
          balance += entry.deltaCredits;
        }
      }
      if (balance < input.creditsReserved) {
        return null;
      }
      const now = new Date();
      const record: PendingActionReservationRecord = {
        id: makeId("reservation"),
        appId: input.appId,
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        actionType: CELERIS_MANAGED_ACTION_TYPE_SAY_HELLO,
        status: "reserved",
        username: input.username,
        message: input.message,
        creditsReserved: input.creditsReserved,
        transactionBytes: input.transactionBytes,
        sponsorSignature: input.sponsorSignature,
        sponsorAddress: input.sponsorAddress,
        expiresAt: input.expiresAt,
        submittedDigest: null,
        createdAt: now,
        updatedAt: now
      };
      pendingActionReservations.set(record.id, record);
      ledgerEntriesByReference.set(`${record.appId}:action_reservation:${record.id}:reserve`, {
        appId: record.appId,
        walletAddress: record.walletAddress,
        deltaCredits: -record.creditsReserved
      });
      return record;
    },
    async findPendingActionReservationById(appId, reservationId) {
      const record = pendingActionReservations.get(reservationId);
      return record?.appId === appId ? record : null;
    },
    async completePendingActionReservation(input) {
      const existing = pendingActionReservations.get(input.reservationId);

      if (!existing || existing.appId !== input.appId || existing.walletAddress !== input.walletAddress) {
        return null;
      }

      if (existing.status === "captured" || existing.status === "released") {
        return {
          reservation: existing,
          transaction: existing.submittedDigest ? transactionRecords.get(`${existing.appId}:${existing.submittedDigest}`) ?? null : null
        };
      }

      if (input.outcome === "failed") {
        const released: PendingActionReservationRecord = {
          ...existing,
          status: "released",
          updatedAt: new Date()
        };
        pendingActionReservations.set(released.id, released);
        ledgerEntriesByReference.set(`${released.appId}:action_reservation:${released.id}:release`, {
          appId: released.appId,
          walletAddress: released.walletAddress,
          deltaCredits: released.creditsReserved
        });
        return { reservation: released, transaction: null };
      }

      if (!input.digest || !input.explorerUrl || !input.verifiedAt) {
        throw new Error("Submitted reservations require digest verification details");
      }

      const captured: PendingActionReservationRecord = {
        ...existing,
        status: "captured",
        submittedDigest: input.digest,
        updatedAt: new Date()
      };
      const transaction: TransactionRecordRecord = {
        id: makeId("tx"),
        appId: captured.appId,
        walletAddress: captured.walletAddress,
        chainId: captured.chainId,
        actionType: captured.actionType,
        username: captured.username,
        message: captured.message,
        digest: input.digest,
        explorerUrl: input.explorerUrl,
        status: "confirmed",
        confirmedAt: input.verifiedAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      pendingActionReservations.set(captured.id, captured);
      transactionRecords.set(`${transaction.appId}:${transaction.digest}`, transaction);
      ledgerEntriesByReference.set(`${captured.appId}:action_reservation:${captured.id}:capture`, {
        appId: captured.appId,
        walletAddress: captured.walletAddress,
        deltaCredits: 0
      });
      return { reservation: captured, transaction };
    },
    async listTransactions(appId) {
      return Array.from(transactionRecords.values())
        .filter((record) => record.appId === appId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    }
  };
}
