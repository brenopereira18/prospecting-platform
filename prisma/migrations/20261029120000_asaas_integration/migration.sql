-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "asaasPaymentId" TEXT;

-- CreateTable
CREATE TABLE "asaas_policies" (
    "userId" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asaas_policies_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "asaas_checkouts" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "contractId" TEXT,
    "publicToken" TEXT NOT NULL,
    "providerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "amount" DECIMAL(12,2) NOT NULL,
    "terms" JSONB NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "requestedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asaas_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_payments" (
    "id" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "installmentId" TEXT,
    "installmentNumber" INTEGER,
    "status" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "buyerCharges" DECIMAL(12,2),
    "providerFee" DECIMAL(12,2),
    "netAmount" DECIMAL(12,2),
    "dueOn" DATE NOT NULL,
    "receivedOn" DATE,
    "invoiceUrl" TEXT,
    "lastError" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asaas_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "externalReference" TEXT,
    "processedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asaas_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asaas_checkouts_publicToken_key" ON "asaas_checkouts"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "asaas_checkouts_providerId_key" ON "asaas_checkouts"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "asaas_checkouts_subscriptionId_key" ON "asaas_checkouts"("subscriptionId");

-- CreateIndex
CREATE INDEX "asaas_checkouts_saleId_createdAt_idx" ON "asaas_checkouts"("saleId", "createdAt");

-- CreateIndex
CREATE INDEX "asaas_checkouts_contractId_status_idx" ON "asaas_checkouts"("contractId", "status");

-- CreateIndex
CREATE INDEX "asaas_payments_checkoutId_dueOn_idx" ON "asaas_payments"("checkoutId", "dueOn");

-- CreateIndex
CREATE INDEX "asaas_events_processedAt_createdAt_idx" ON "asaas_events"("processedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_asaasPaymentId_fkey" FOREIGN KEY ("asaasPaymentId") REFERENCES "asaas_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_policies" ADD CONSTRAINT "asaas_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_checkouts" ADD CONSTRAINT "asaas_checkouts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_checkouts" ADD CONSTRAINT "asaas_checkouts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "recurring_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_payments" ADD CONSTRAINT "asaas_payments_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "asaas_checkouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asaas_checkouts" ADD CONSTRAINT "asaas_checkout_positive_amount" CHECK (amount > 0);
CREATE UNIQUE INDEX "asaas_one_open_sale_checkout" ON "asaas_checkouts"("saleId") WHERE "contractId" IS NULL AND status NOT IN ('CANCELED','EXPIRED','REJECTED');
CREATE UNIQUE INDEX "asaas_one_open_contract_checkout" ON "asaas_checkouts"("contractId") WHERE "contractId" IS NOT NULL AND status NOT IN ('CANCELED','EXPIRED','REJECTED');
