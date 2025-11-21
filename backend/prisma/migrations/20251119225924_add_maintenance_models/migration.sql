-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "maintenanceCarryoverMode" TEXT,
ADD COLUMN     "maintenanceExtraHourlyRate" DOUBLE PRECISION,
ADD COLUMN     "maintenanceHoursPerMonth" DOUBLE PRECISION,
ADD COLUMN     "maintenanceNotesInternal" TEXT,
ADD COLUMN     "maintenancePlanName" TEXT,
ADD COLUMN     "maintenanceStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenanceCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseHours" DOUBLE PRECISION NOT NULL,
    "carriedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extraHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceCycle_tenantId_month_key" ON "MaintenanceCycle"("tenantId", "month");

-- AddForeignKey
ALTER TABLE "MaintenanceCycle" ADD CONSTRAINT "MaintenanceCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
