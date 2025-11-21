-- Drop unused maintenance columns and extraHours
ALTER TABLE "Tenant"
  DROP COLUMN IF EXISTS "maintenanceExtraHourlyRate",
  DROP COLUMN IF EXISTS "maintenanceNotesInternal";

ALTER TABLE "MaintenanceCycle"
  DROP COLUMN IF EXISTS "extraHours";

