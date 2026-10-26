import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectionSchedule,
  conditionsSchema,
  receiptSchema,
  saleSchema,
  receivableState,
  todayInSaoPaulo,
} from "./finance.schema";
import { FinanceService } from "./finance.service";
import type { PrismaClient } from "../../../generated/prisma/client";
import { moneyCents } from "../proposals/proposal.schema";
const conditions = {
  total: "1000.00",
  deposit: "100.00",
  depositMethod: "PIX" as const,
  depositInstallments: 1,
  balanceMethod: "CARTAO" as const,
  balanceInstallments: 3,
  depositDueOn: "2026-01-31",
  balanceDueOn: "2026-01-31",
};
test("schedule generates exact entry and balance without marking payments received", () => {
  const rows = collectionSchedule(conditions);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].amount, "100.00");
  assert.equal(
    rows.slice(1).reduce((s, r) => s + moneyCents(r.amount), 0),
    90000,
  );
  assert.equal(rows[0].paymentMethod, "PIX");
  assert.equal(rows[1].paymentMethod, "CARTAO");
});
test("uneven installments distribute cents without losing or creating money", () => {
  const rows = collectionSchedule({
    ...conditions,
    deposit: "0",
    total: "100.00",
  });
  assert.deepEqual(
    rows.map((r) => r.amount),
    ["33.34", "33.33", "33.33"],
  );
  assert.deepEqual(
    rows.map((r) => r.dueOn),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});
test("leap year installments preserve the anchor day", () => {
  assert.deepEqual(
    collectionSchedule({
      ...conditions,
      deposit: "0",
      balanceDueOn: "2024-01-31",
    }).map((r) => r.dueOn),
    ["2024-01-31", "2024-02-29", "2024-03-31"],
  );
});
test("full Pix and all-entry payment do not generate zero-value accounts", () => {
  assert.equal(
    collectionSchedule({
      ...conditions,
      deposit: "0",
      balanceMethod: "PIX",
      balanceInstallments: 1,
    }).length,
    1,
  );
  assert.equal(
    collectionSchedule({ ...conditions, deposit: "1000" }).length,
    1,
  );
});
test("rejects over-total entry, fractional parts, Pix installments, precision loss and zero parts", () => {
  for (const change of [
    { deposit: "1000.01" },
    { balanceInstallments: 1.5 },
    { depositInstallments: 2 },
    { balanceInstallments: 25 },
    { total: "10.001" },
    { total: "0" },
    { total: "0.01", deposit: "0", balanceInstallments: 3 },
    { balanceDueOn: "2026-02-30" },
    { balanceDueOn: "9999-12-31" },
  ])
    assert.equal(
      conditionsSchema.safeParse({ ...conditions, ...change }).success,
      false,
    );
});
test("receipt validation disallows negative, zero, NaN and client ownership fields", () => {
  const base = {
    id: "3105412c-0182-4b36-8d43-d45f8caf7111",
    receivableId: "3105412c-0182-4b36-8d43-d45f8caf7112",
    amount: "10.25",
    receivedOn: "2026-01-01",
    paymentMethod: "PIX",
    notes: "",
  };
  assert.equal(receiptSchema.safeParse(base).success, true);
  for (const amount of ["0", "-1", "NaN", "Infinity", "10.256"])
    assert.equal(receiptSchema.safeParse({ ...base, amount }).success, false);
  assert.equal(
    receiptSchema.safeParse({ ...base, userId: "attacker" }).success,
    false,
  );
});
test("pending, partial, paid and overdue states remain distinct", () => {
  assert.deepEqual(receivableState("100", "0", "2026-01-10", "2026-01-10"), {
    outstanding: "100.00",
    status: "Pendente",
    overdue: false,
  });
  assert.deepEqual(receivableState("100", "20", "2026-01-10", "2026-01-11"), {
    outstanding: "80.00",
    status: "Parcialmente recebido",
    overdue: true,
  });
  assert.deepEqual(receivableState("100", "100", "2026-01-10", "2026-01-11"), {
    outstanding: "0.00",
    status: "Recebido",
    overdue: false,
  });
});
test("business dates use Sao Paulo regardless of server timezone", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-10-27T02:59:59Z")), "2026-10-26");
  assert.equal(todayInSaoPaulo(new Date("2026-10-27T03:00:00Z")), "2026-10-27");
});
test("sale contract refuses ownership injection and invalid dates", () => {
  const base = {
    id: "3105412c-0182-4b36-8d43-d45f8caf7111",
    leadId: "3105412c-0182-4b36-8d43-d45f8caf7112",
    proposalId: "3105412c-0182-4b36-8d43-d45f8caf7113",
    expectedProposalRevision: 2,
    soldOn: "2026-01-01",
    conditions,
  };
  assert.equal(saleSchema.safeParse(base).success, true);
  assert.equal(
    saleSchema.safeParse({ ...base, userId: "injected" }).success,
    false,
  );
  assert.equal(
    saleSchema.safeParse({ ...base, soldOn: "2026-02-30" }).success,
    false,
  );
});
test("all financial operations reject missing authentication before touching storage", async () => {
  const service = new FinanceService({} as PrismaClient);
  for (const operation of [
    () => service.createSale({}, ""),
    () => service.receive({}, ""),
    () => service.reverse({}, ""),
    () => service.get("bad", ""),
    () => service.forLead("bad", ""),
    () => service.overview(""),
  ])
    await assert.rejects(operation, { code: "UNAUTHENTICATED" });
});
