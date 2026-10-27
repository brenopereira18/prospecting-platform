import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client";
import { RecurringService } from "./recurring.service";
import {
  contractTermsSchema,
  createContractSchema,
  contractStatusSchema,
  generateMonthlySchema,
  monthlyDueOn,
} from "./recurring.schema";

const terms = {
  kind: "AMBOS",
  description: "Hospedagem e suporte",
  monthlyAmount: "199,90",
  dueDay: 31,
  paymentMethod: "PIX",
  notes: "",
};
test("contract terms accept all service kinds and normalize exact money", () => {
  for (const kind of ["HOSPEDAGEM", "MANUTENCAO", "AMBOS"])
    assert.equal(
      contractTermsSchema.parse({ ...terms, kind }).monthlyAmount,
      "199.90",
    );
});
test("contract terms reject invalid money, dates, day and ownership injection", () => {
  for (const change of [
    { monthlyAmount: "0" },
    { monthlyAmount: "-1" },
    { monthlyAmount: "NaN" },
    { monthlyAmount: "1.001" },
    { dueDay: 0 },
    { dueDay: 32 },
    { dueDay: 1.5 },
    { kind: "OUTRO" },
    { userId: randomUUID() },
  ])
    assert.equal(
      contractTermsSchema.safeParse({ ...terms, ...change }).success,
      false,
    );
  const data = {
    id: randomUUID(),
    saleId: randomUUID(),
    startsOn: "2026-02-30",
    terms,
  };
  assert.equal(createContractSchema.safeParse(data).success, false);
  assert.equal(
    createContractSchema.safeParse({
      ...data,
      startsOn: "2026-02-01",
      userId: randomUUID(),
    }).success,
    false,
  );
});
test("monthly due dates clamp February, leap years and 30-day months without drifting", () => {
  assert.equal(monthlyDueOn("2026-02", 31, "2026-01-01"), "2026-02-28");
  assert.equal(monthlyDueOn("2024-02", 31, "2024-01-01"), "2024-02-29");
  assert.equal(monthlyDueOn("2026-04", 31, "2026-01-01"), "2026-04-30");
  assert.equal(monthlyDueOn("2026-05", 31, "2026-01-01"), "2026-05-31");
  assert.equal(monthlyDueOn("2027-01", 10, "2026-12-01"), "2027-01-10");
});
test("first due date never predates contract start", () => {
  assert.equal(monthlyDueOn("2026-10", 5, "2026-10-22"), "2026-10-22");
  assert.equal(monthlyDueOn("2026-11", 5, "2026-10-22"), "2026-11-05");
});
test("commands require revision, reason and valid competence; cannot backdate status", () => {
  const command = { id: randomUUID(), expectedRevision: 0 };
  assert.equal(
    contractStatusSchema.safeParse({
      ...command,
      status: "SUSPENSO",
      reason: "",
    }).success,
    false,
  );
  assert.equal(
    contractStatusSchema.safeParse({
      ...command,
      status: "SUSPENSO",
      reason: "Pausa",
      occurredAt: "2020-01-01",
    }).success,
    false,
  );
  for (const competence of ["2026-13", "2026-2", "2026-02-01", "0000-01"])
    assert.equal(
      generateMonthlySchema.safeParse({ ...command, competence }).success,
      false,
    );
});
test("all recurring operations reject missing authentication before any database access", async () => {
  const service = new RecurringService({} as PrismaClient);
  for (const run of [
    () => service.create({}, ""),
    () => service.update({}, ""),
    () => service.changeStatus({}, ""),
    () => service.generate({}, ""),
    () => service.get("bad", ""),
    () => service.list(""),
  ])
    await assert.rejects(run, { code: "UNAUTHENTICATED" });
});
