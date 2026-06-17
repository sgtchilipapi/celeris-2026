CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "successRedirectUrl" TEXT NOT NULL,
    "cancelRedirectUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "deltaCredits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckoutSession_appId_idx" ON "CheckoutSession"("appId");
CREATE INDEX "CheckoutSession_walletAddress_idx" ON "CheckoutSession"("walletAddress");
CREATE INDEX "CheckoutSession_status_idx" ON "CheckoutSession"("status");
CREATE INDEX "CreditLedgerEntry_appId_walletAddress_idx" ON "CreditLedgerEntry"("appId", "walletAddress");
CREATE UNIQUE INDEX "CreditLedgerEntry_appId_referenceType_referenceId_reason_key" ON "CreditLedgerEntry"("appId", "referenceType", "referenceId", "reason");

ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
