-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "ProposalPaymentMethod" AS ENUM ('PIX', 'CARTAO');

-- CreateTable
CREATE TABLE "commercial_proposals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sourceProposalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL,
    "depositMethod" "ProposalPaymentMethod" NOT NULL,
    "depositInstallments" INTEGER NOT NULL DEFAULT 1,
    "balanceMethod" "ProposalPaymentMethod" NOT NULL,
    "balanceInstallments" INTEGER NOT NULL DEFAULT 1,
    "deliveryDays" INTEGER NOT NULL,
    "validUntil" DATE NOT NULL,
    "notes" TEXT NOT NULL,
    "managedHosting" BOOLEAN NOT NULL DEFAULT false,
    "monthlyAmount" DECIMAL(12,2),
    "maintenance" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientAddress" TEXT,
    "clientPhone" TEXT,
    "issuerName" TEXT NOT NULL,
    "issuerEmail" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commercial_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_status_history" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fromStatus" "ProposalStatus" NOT NULL,
    "toStatus" "ProposalStatus" NOT NULL,
    "revision" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_proposals_userId_leadId_deletedAt_createdAt_idx" ON "commercial_proposals"("userId", "leadId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "commercial_proposals_sourceProposalId_idx" ON "commercial_proposals"("sourceProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_status_history_proposalId_revision_key" ON "proposal_status_history"("proposalId", "revision");

-- AddForeignKey
ALTER TABLE "commercial_proposals" ADD CONSTRAINT "commercial_proposals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_proposals" ADD CONSTRAINT "commercial_proposals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_proposals" ADD CONSTRAINT "commercial_proposals_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "commercial_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_status_history" ADD CONSTRAINT "proposal_status_history_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "commercial_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Monetary and payment invariants also hold outside the application.
ALTER TABLE "commercial_proposals" ADD CONSTRAINT "proposal_values_check" CHECK (
  "total" > 0 AND "deposit" >= 0 AND "deposit" <= "total"
  AND "depositInstallments" BETWEEN 1 AND 24 AND "balanceInstallments" BETWEEN 1 AND 24
  AND ("depositMethod" <> 'PIX' OR "depositInstallments" = 1)
  AND ("balanceMethod" <> 'PIX' OR "balanceInstallments" = 1)
  AND "deliveryDays" BETWEEN 1 AND 3650 AND "revision" >= 0
  AND (("managedHosting" AND "monthlyAmount" > 0 AND "monthlyAmount" IS NOT NULL) OR (NOT "managedHosting" AND "monthlyAmount" IS NULL))
);

-- Once presented, only lifecycle metadata can change. The commercial snapshot stays intact.
CREATE FUNCTION preserve_proposal_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."lockedAt" IS NOT NULL AND
     (to_jsonb(OLD) - ARRAY['status','revision','updatedAt','deletedAt']) IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','revision','updatedAt','deletedAt']) THEN
    RAISE EXCEPTION 'Presented proposal content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "preserve_proposal_content" BEFORE UPDATE ON "commercial_proposals"
FOR EACH ROW EXECUTE FUNCTION preserve_proposal_content();
