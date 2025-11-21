-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "hostingOrdered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenanceOrdered" BOOLEAN NOT NULL DEFAULT false;
