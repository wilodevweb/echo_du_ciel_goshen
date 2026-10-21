ALTER TABLE "Attendance" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

UPDATE "Attendance" SET "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX "Attendance_updatedAt_idx" ON "Attendance"("updatedAt");
