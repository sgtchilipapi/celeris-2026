CREATE TABLE "PendingActionReservation" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "creditsReserved" INTEGER NOT NULL,
    "transactionBytes" TEXT NOT NULL,
    "sponsorSignature" TEXT NOT NULL,
    "sponsorAddress" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingActionReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SponsorGasCoinLock" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorGasCoinLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionRecord" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingActionReservation_appId_walletAddress_idx" ON "PendingActionReservation"("appId", "walletAddress");
CREATE INDEX "PendingActionReservation_status_expiresAt_idx" ON "PendingActionReservation"("status", "expiresAt");
CREATE UNIQUE INDEX "SponsorGasCoinLock_reservationId_key" ON "SponsorGasCoinLock"("reservationId");
CREATE INDEX "SponsorGasCoinLock_appId_status_idx" ON "SponsorGasCoinLock"("appId", "status");
CREATE UNIQUE INDEX "TransactionRecord_appId_digest_key" ON "TransactionRecord"("appId", "digest");
CREATE INDEX "TransactionRecord_appId_createdAt_idx" ON "TransactionRecord"("appId", "createdAt");

ALTER TABLE "PendingActionReservation" ADD CONSTRAINT "PendingActionReservation_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsorGasCoinLock" ADD CONSTRAINT "SponsorGasCoinLock_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsorGasCoinLock" ADD CONSTRAINT "SponsorGasCoinLock_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PendingActionReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionRecord" ADD CONSTRAINT "TransactionRecord_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
