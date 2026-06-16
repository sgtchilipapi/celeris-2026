-- CreateTable
CREATE TABLE "DeveloperAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperSession" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "allowedChainId" TEXT NOT NULL,
    "authProvider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedAction" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "priceCredits" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorWallet" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "chainFamily" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsorWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisteredProgram" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "chainFamily" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "appStateObjectId" TEXT NOT NULL,
    "authorityCapObjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisteredProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperAccount_email_key" ON "DeveloperAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperSession_tokenHash_key" ON "DeveloperSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DeveloperSession_developerId_idx" ON "DeveloperSession"("developerId");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE INDEX "App_developerId_idx" ON "App"("developerId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedAction_appId_actionType_key" ON "ManagedAction"("appId", "actionType");

-- CreateIndex
CREATE INDEX "ManagedAction_appId_idx" ON "ManagedAction"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorWallet_appId_chainFamily_network_key" ON "SponsorWallet"("appId", "chainFamily", "network");

-- CreateIndex
CREATE INDEX "SponsorWallet_appId_idx" ON "SponsorWallet"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredProgram_appId_chainFamily_network_key" ON "RegisteredProgram"("appId", "chainFamily", "network");

-- CreateIndex
CREATE INDEX "RegisteredProgram_appId_idx" ON "RegisteredProgram"("appId");

-- AddForeignKey
ALTER TABLE "DeveloperSession" ADD CONSTRAINT "DeveloperSession_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "DeveloperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "DeveloperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedAction" ADD CONSTRAINT "ManagedAction_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorWallet" ADD CONSTRAINT "SponsorWallet_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisteredProgram" ADD CONSTRAINT "RegisteredProgram_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
