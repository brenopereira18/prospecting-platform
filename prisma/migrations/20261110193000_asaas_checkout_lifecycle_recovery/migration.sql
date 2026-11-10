BEGIN;

-- PAID is historical truth, not an available checkout. Keep exactly one
-- available/in-flight attempt, while permitting late payments on older ones.
LOCK TABLE "asaas_checkouts" IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX "asaas_one_open_sale_checkout";
DROP INDEX "asaas_one_open_contract_checkout";
CREATE UNIQUE INDEX "asaas_one_open_sale_checkout" ON "asaas_checkouts"("saleId")
WHERE "contractId" IS NULL AND status NOT IN ('PAID','CANCELED','EXPIRED','REJECTED');
CREATE UNIQUE INDEX "asaas_one_open_contract_checkout" ON "asaas_checkouts"("contractId")
WHERE "contractId" IS NOT NULL AND status NOT IN ('PAID','CANCELED','EXPIRED','REJECTED');

ALTER TABLE "asaas_events"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "failedAt" TIMESTAMPTZ(3);
ALTER TABLE "asaas_events" ADD CONSTRAINT "asaas_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attribute legacy events only where persisted identifiers prove a unique
-- owner. Unknown events remain unassigned; never guess their ownership.
WITH owners AS (
  SELECT e.id, MIN(s."userId") AS "userId"
  FROM "asaas_events" e
  JOIN "asaas_checkouts" c ON e."resourceId" = c."providerId"
    OR e."resourceId" = c."subscriptionId" OR e."externalReference" = c.id
    OR EXISTS (SELECT 1 FROM "asaas_payments" p WHERE p.id = e."resourceId" AND p."checkoutId" = c.id)
  JOIN "sales" s ON s.id = c."saleId"
  GROUP BY e.id HAVING COUNT(DISTINCT s."userId") = 1
)
UPDATE "asaas_events" e SET "userId" = owners."userId" FROM owners WHERE e.id = owners.id;

CREATE INDEX "asaas_events_userId_processedAt_failedAt_nextAttemptAt_idx"
  ON "asaas_events"("userId", "processedAt", "failedAt", "nextAttemptAt");

COMMIT;
