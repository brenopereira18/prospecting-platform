-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "soldOn" DATE NOT NULL,
    "proposalSnapshot" JSONB NOT NULL,
    "agreedConditions" JSONB NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueOn" DATE NOT NULL,
    "paymentMethod" "ProposalPaymentMethod" NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedOn" DATE NOT NULL,
    "paymentMethod" "ProposalPaymentMethod" NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_reversals" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_proposalId_key" ON "sales"("proposalId");

-- CreateIndex
CREATE INDEX "sales_userId_soldOn_id_idx" ON "sales"("userId", "soldOn", "id");

-- CreateIndex
CREATE INDEX "sales_leadId_idx" ON "sales"("leadId");

-- CreateIndex
CREATE INDEX "receivables_dueOn_saleId_idx" ON "receivables"("dueOn", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_saleId_sequence_key" ON "receivables"("saleId", "sequence");

-- CreateIndex
CREATE INDEX "receipts_receivableId_receivedOn_idx" ON "receipts"("receivableId", "receivedOn");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_reversals_receiptId_key" ON "receipt_reversals"("receiptId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "commercial_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_reversals" ADD CONSTRAINT "receipt_reversals_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales" ADD CONSTRAINT "sales_positive_total" CHECK ("total" > 0);
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_positive_amount" CHECK ("amount" > 0 AND "sequence" > 0);
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "receipt_reversals" ADD CONSTRAINT "receipt_reversals_reason" CHECK (length(trim("reason")) >= 3);

-- Historical monetary records are append-only through the application.
-- Corrections append receipt_reversals instead of rewriting receipts.
CREATE FUNCTION preserve_financial_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
    RAISE EXCEPTION 'Financial records cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_sale BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION preserve_financial_record();
CREATE TRIGGER preserve_receivable BEFORE UPDATE ON receivables FOR EACH ROW EXECUTE FUNCTION preserve_financial_record();
CREATE TRIGGER preserve_receipt BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION preserve_financial_record();
CREATE TRIGGER preserve_receipt_reversal BEFORE UPDATE ON receipt_reversals FOR EACH ROW EXECUTE FUNCTION preserve_financial_record();
