-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "hostingExpirationDate" TIMESTAMP(3),
ADD COLUMN     "maintenanceExpirationDate" TIMESTAMP(3);
