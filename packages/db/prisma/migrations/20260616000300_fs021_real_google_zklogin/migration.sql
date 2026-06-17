ALTER TABLE "UserIdentity"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "displayName" TEXT;

UPDATE "UserIdentity"
SET "email" = "subject"
WHERE "email" IS NULL;

ALTER TABLE "UserIdentity"
  ALTER COLUMN "email" SET NOT NULL;

ALTER TABLE "AuthLoginRequest"
  ADD COLUMN "oauthState" TEXT,
  ADD COLUMN "nonce" TEXT,
  ADD COLUMN "extendedEphemeralPublicKey" TEXT,
  ADD COLUMN "maxEpoch" INTEGER,
  ADD COLUMN "jwtRandomness" TEXT,
  ADD COLUMN "zkLoginProofInputsJson" TEXT,
  ADD COLUMN "userIdentityId" TEXT;

CREATE UNIQUE INDEX "AuthLoginRequest_oauthState_key" ON "AuthLoginRequest"("oauthState");
CREATE INDEX "AuthLoginRequest_userIdentityId_idx" ON "AuthLoginRequest"("userIdentityId");

ALTER TABLE "UserSession"
  ADD COLUMN "zkLoginProofInputsJson" TEXT;
