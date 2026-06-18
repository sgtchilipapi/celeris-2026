ALTER TABLE "PendingActionReservation" ADD COLUMN "metadataJson" TEXT;
ALTER TABLE "PendingActionReservation" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "PendingActionReservation" ALTER COLUMN "message" DROP NOT NULL;

ALTER TABLE "TransactionRecord" ADD COLUMN "metadataJson" TEXT;
ALTER TABLE "TransactionRecord" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "TransactionRecord" ALTER COLUMN "message" DROP NOT NULL;
