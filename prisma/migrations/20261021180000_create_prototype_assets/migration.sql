-- CreateTable
CREATE TABLE "prototype_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prototypeId" TEXT,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "prototype_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prototype_assets_objectKey_key" ON "prototype_assets"("objectKey");

-- CreateIndex
CREATE INDEX "prototype_assets_userId_prototypeId_createdAt_idx" ON "prototype_assets"("userId", "prototypeId", "createdAt");

-- AddForeignKey
ALTER TABLE "prototype_assets" ADD CONSTRAINT "prototype_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prototype_assets" ADD CONSTRAINT "prototype_assets_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "prototypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep object metadata valid even when written outside the application service.
ALTER TABLE "prototype_assets" ADD CONSTRAINT "prototype_assets_image_check" CHECK (
  "mimeType" IN ('image/jpeg', 'image/png', 'image/webp')
  AND "sizeBytes" > 0 AND "sizeBytes" <= 5242880
  AND "width" > 0 AND "height" > 0
  AND "width"::BIGINT * "height"::BIGINT <= 20000000
  AND "sha256" ~ '^[a-f0-9]{64}$'
  AND ("deletedAt" IS NULL OR "deletionRequestedAt" IS NOT NULL)
);
