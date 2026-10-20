-- CreateTable
CREATE TABLE "prototypes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "draftDocument" JSONB NOT NULL,
    "draftRevision" INTEGER NOT NULL DEFAULT 0,
    "versionSequence" INTEGER NOT NULL DEFAULT 0,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prototypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prototype_versions" (
    "id" TEXT NOT NULL,
    "prototypeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prototype_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prototypes_userId_updatedAt_idx" ON "prototypes"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "prototypes_leadId_idx" ON "prototypes"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "prototype_versions_prototypeId_number_key" ON "prototype_versions"("prototypeId", "number");

-- AddForeignKey
ALTER TABLE "prototypes" ADD CONSTRAINT "prototypes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prototypes" ADD CONSTRAINT "prototypes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prototype_versions" ADD CONSTRAINT "prototype_versions_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "prototypes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Counters and saved versions must stay valid even outside the application service.
ALTER TABLE "prototypes" ADD CONSTRAINT "prototypes_counters_check" CHECK ("draftRevision" >= 0 AND "versionSequence" >= 0 AND "templateVersion" > 0);
ALTER TABLE "prototype_versions" ADD CONSTRAINT "prototype_versions_number_check" CHECK ("number" > 0);

CREATE FUNCTION "reject_prototype_version_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Prototype versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "prototype_versions_immutable"
BEFORE UPDATE ON "prototype_versions"
FOR EACH ROW EXECUTE FUNCTION "reject_prototype_version_update"();
