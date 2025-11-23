-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ga4ConnectedAt" TIMESTAMP(3),
ADD COLUMN     "ga4LastSyncStatus" TEXT,
ADD COLUMN     "ga4PropertyId" TEXT;
