-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperProfile" (
    "id" TEXT NOT NULL,
    "userIdentityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthLoginRequest" (
    "id" TEXT NOT NULL,
    "clientKind" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appId" TEXT,
    "state" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "authCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userIdentityId" TEXT NOT NULL,
    "clientKind" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appId" TEXT,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "App" ADD COLUMN "developerProfileId" TEXT;

-- AlterTable
ALTER TABLE "App" ALTER COLUMN "developerId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_issuer_subject_key" ON "UserIdentity"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_userIdentityId_key" ON "DeveloperProfile"("userIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_email_key" ON "DeveloperProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthLoginRequest_authCode_key" ON "AuthLoginRequest"("authCode");

-- CreateIndex
CREATE INDEX "AuthLoginRequest_clientKind_clientId_idx" ON "AuthLoginRequest"("clientKind", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userIdentityId_idx" ON "UserSession"("userIdentityId");

-- CreateIndex
CREATE INDEX "UserSession_clientKind_clientId_idx" ON "UserSession"("clientKind", "clientId");

-- CreateIndex
CREATE INDEX "App_developerProfileId_idx" ON "App"("developerProfileId");

-- AddForeignKey
ALTER TABLE "DeveloperProfile" ADD CONSTRAINT "DeveloperProfile_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userIdentityId_fkey" FOREIGN KEY ("userIdentityId") REFERENCES "UserIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_developerProfileId_fkey" FOREIGN KEY ("developerProfileId") REFERENCES "DeveloperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
