-- CreateTable
CREATE TABLE "MaintenanceFeature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMaintenanceFeature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantMaintenanceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceFeature_key_key" ON "MaintenanceFeature"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMaintenanceFeature_tenantId_featureId_key" ON "TenantMaintenanceFeature"("tenantId", "featureId");

-- AddForeignKey
ALTER TABLE "TenantMaintenanceFeature" ADD CONSTRAINT "TenantMaintenanceFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMaintenanceFeature" ADD CONSTRAINT "TenantMaintenanceFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "MaintenanceFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
