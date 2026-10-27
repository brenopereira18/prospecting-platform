CREATE TYPE "RecurringContractStatus" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');
CREATE TYPE "RecurringServiceKind" AS ENUM ('HOSPEDAGEM', 'MANUTENCAO', 'AMBOS');

ALTER TABLE "receivables" ADD COLUMN "competence" DATE,
ADD COLUMN "contractId" TEXT, ALTER COLUMN "sequence" DROP NOT NULL;

CREATE TABLE "recurring_contracts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saleId" TEXT NOT NULL,
  "kind" "RecurringServiceKind" NOT NULL,
  "description" TEXT NOT NULL,
  "monthlyAmount" DECIMAL(12,2) NOT NULL,
  "startsOn" DATE NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "paymentMethod" "ProposalPaymentMethod" NOT NULL,
  "notes" TEXT NOT NULL,
  "status" "RecurringContractStatus" NOT NULL DEFAULT 'ATIVO',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recurring_contracts_terms" CHECK ("monthlyAmount" > 0 AND "dueDay" BETWEEN 1 AND 31 AND "revision" >= 0)
);
CREATE TABLE "recurring_contract_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "fromStatus" "RecurringContractStatus",
  "toStatus" "RecurringContractStatus" NOT NULL,
  "effectiveMonth" DATE NOT NULL,
  "conditions" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_history_month" CHECK (EXTRACT(DAY FROM "effectiveMonth")=1 AND "revision" >= 0)
);
CREATE INDEX "recurring_contracts_saleId_status_idx" ON "recurring_contracts"("saleId", "status");
CREATE UNIQUE INDEX "recurring_contracts_id_saleId_key" ON "recurring_contracts"("id", "saleId");
CREATE INDEX "recurring_contract_history_contractId_effectiveMonth_revisi_idx" ON "recurring_contract_history"("contractId", "effectiveMonth", "revision");
CREATE UNIQUE INDEX "recurring_contract_history_contractId_revision_key" ON "recurring_contract_history"("contractId", "revision");
CREATE UNIQUE INDEX "receivables_contractId_competence_key" ON "receivables"("contractId", "competence");
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_contract_history" ADD CONSTRAINT "recurring_contract_history_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "recurring_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_contractId_saleId_fkey" FOREIGN KEY ("contractId", "saleId") REFERENCES "recurring_contracts"("id", "saleId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_origin" CHECK (
  ("contractId" IS NULL AND "competence" IS NULL AND "sequence" IS NOT NULL AND "sequence">0)
  OR ("contractId" IS NOT NULL AND "competence" IS NOT NULL AND "sequence" IS NULL AND EXTRACT(DAY FROM "competence")=1)
);
CREATE TRIGGER preserve_recurring_history BEFORE UPDATE ON recurring_contract_history FOR EACH ROW EXECUTE FUNCTION preserve_financial_record();
