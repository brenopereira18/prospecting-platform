-- Existing leads keep their current status. No historical transitions are inferred.
ALTER TABLE "leads" ADD COLUMN "statusRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_revision_check" CHECK ("statusRevision" >= 0);

CREATE TABLE "lead_status_history" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "fromStatus" "LeadStatus" NOT NULL,
  "toStatus" "LeadStatus" NOT NULL,
  "revision" INTEGER NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_status_history_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "lead_status_history_changed_check" CHECK ("fromStatus" <> "toStatus")
);

CREATE UNIQUE INDEX "lead_status_history_leadId_revision_key" ON "lead_status_history"("leadId", "revision");
CREATE INDEX "lead_status_history_leadId_occurredAt_idx" ON "lead_status_history"("leadId", "occurredAt");
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Like prototype snapshots, a recorded transition must not be rewritten.
CREATE FUNCTION "reject_lead_status_history_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Lead status history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lead_status_history_immutable" BEFORE UPDATE ON "lead_status_history"
  FOR EACH ROW EXECUTE FUNCTION "reject_lead_status_history_update"();
