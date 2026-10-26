-- Existing proposals keep all their original terms, including locked proposals.
CREATE TYPE "ProposalPaymentMode" AS ENUM ('A_NEGOCIAR', 'DEFINIDAS');
ALTER TABLE "commercial_proposals"
  ADD COLUMN "paymentMode" "ProposalPaymentMode" NOT NULL DEFAULT 'DEFINIDAS',
  ALTER COLUMN "deposit" DROP NOT NULL,
  ALTER COLUMN "depositMethod" DROP NOT NULL,
  ALTER COLUMN "depositInstallments" DROP NOT NULL,
  ALTER COLUMN "depositInstallments" DROP DEFAULT,
  ALTER COLUMN "balanceMethod" DROP NOT NULL,
  ALTER COLUMN "balanceInstallments" DROP NOT NULL,
  ALTER COLUMN "balanceInstallments" DROP DEFAULT;

ALTER TABLE "commercial_proposals" DROP CONSTRAINT "proposal_values_check";
ALTER TABLE "commercial_proposals" ADD CONSTRAINT "proposal_values_check" CHECK (
  "total" > 0 AND "deliveryDays" BETWEEN 1 AND 3650 AND "revision" >= 0
  AND (("managedHosting" AND "monthlyAmount" > 0 AND "monthlyAmount" IS NOT NULL)
    OR (NOT "managedHosting" AND "monthlyAmount" IS NULL))
  AND (
    ("paymentMode" = 'A_NEGOCIAR' AND "deposit" IS NULL AND "depositMethod" IS NULL
      AND "depositInstallments" IS NULL AND "balanceMethod" IS NULL AND "balanceInstallments" IS NULL)
    OR
    ("paymentMode" = 'DEFINIDAS' AND "deposit" IS NOT NULL AND "depositMethod" IS NOT NULL
      AND "depositInstallments" IS NOT NULL AND "balanceMethod" IS NOT NULL AND "balanceInstallments" IS NOT NULL
      AND "deposit" >= 0 AND "deposit" <= "total"
      AND "depositInstallments" BETWEEN 1 AND 24 AND "balanceInstallments" BETWEEN 1 AND 24
      AND ("depositMethod" <> 'PIX' OR "depositInstallments" = 1)
      AND ("balanceMethod" <> 'PIX' OR "balanceInstallments" = 1))
  )
);
-- The existing content-preservation trigger also protects paymentMode automatically.
