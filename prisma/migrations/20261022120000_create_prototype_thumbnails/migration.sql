CREATE TABLE "prototype_thumbnails" (
    "versionId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prototype_thumbnails_pkey" PRIMARY KEY ("versionId"),
    CONSTRAINT "prototype_thumbnails_status_check" CHECK ("status" IN ('generating', 'ready', 'failed'))
);

CREATE UNIQUE INDEX "prototype_thumbnails_objectKey_key" ON "prototype_thumbnails"("objectKey");
ALTER TABLE "prototype_thumbnails" ADD CONSTRAINT "prototype_thumbnails_versionId_fkey"
FOREIGN KEY ("versionId") REFERENCES "prototype_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
