import assert from "node:assert/strict";
import { test } from "node:test";
import { AsaasClient, AsaasError, hostedCheckoutUrl } from "./asaas.client";
import {
  asaasPolicySchema,
  defaultAsaasPolicy,
  installmentLimit,
  financialAmounts,
  webhookSchema,
  firstAsaasDueDate,
} from "./asaas.schema";

test("recurrence starts on the next configured due day, including short months", () => {
  assert.equal(firstAsaasDueDate(10, "2026-10-01", "2026-10-27"), "2026-11-10");
  assert.equal(firstAsaasDueDate(28, "2026-10-01", "2026-10-27"), "2026-10-28");
  assert.equal(firstAsaasDueDate(31, "2028-02-01", "2028-02-10"), "2028-02-29");
  assert.equal(firstAsaasDueDate(31, "2027-02-01", "2027-02-10"), "2027-02-28");
  assert.equal(firstAsaasDueDate(10, "2027-01-15", "2026-12-30"), "2027-02-10");
});

test("installment policies enforce provider limits, minimum and amount bands", () => {
  const p = {
    ...defaultAsaasPolicy,
    maxInstallments: 21,
    bands: [
      { from: "500.00", maxInstallments: 3 },
      { from: "1000.00", maxInstallments: 12 },
    ],
  };
  assert.equal(installmentLimit("100.00", p), 1);
  assert.equal(installmentLimit("500.00", p), 3);
  assert.equal(installmentLimit("1000.00", p), 12);
  assert.equal(installmentLimit("10.00", { ...p, bands: [] }), 2);
  assert.equal(installmentLimit("9.99", { ...p, bands: [] }), 1);
  assert.throws(() => installmentLimit("4.99", p));
  assert.equal(
    asaasPolicySchema.safeParse({ ...p, maxInstallments: 22 }).success,
    false,
  );
  assert.equal(
    asaasPolicySchema.safeParse({ ...p, minInstallment: "4.99" }).success,
    false,
  );
  assert.equal(
    asaasPolicySchema.safeParse({ ...p, bands: [p.bands[0], p.bands[0]] })
      .success,
    false,
  );
});
test("unsupported buyer fee passthrough is rejected, not approximated", () => {
  assert.equal(
    asaasPolicySchema.safeParse({ ...defaultAsaasPolicy, costMode: "BUYER" })
      .success,
    false,
  );
});
test("provider monetary fields distinguish principal, charges, fees and net", () => {
  const p = {
    id: "pay_test",
    status: "RECEIVED",
    billingType: "PIX",
    value: 105,
    originalValue: 100,
    netValue: 103,
    dueDate: "2026-01-01",
  };
  assert.deepEqual(financialAmounts(p), {
    gross: 10500,
    net: 10300,
    fee: 200,
    buyerCharges: 500,
  });
  assert.deepEqual(
    financialAmounts({ ...p, netValue: null, originalValue: null }),
    { gross: 10500, net: null, fee: null, buyerCharges: null },
  );
  assert.throws(() => financialAmounts({ ...p, netValue: 106 }));
  assert.throws(() => financialAmounts({ ...p, value: NaN }));
});
test("webhook schema strips sensitive/unneeded payloads and validates resource", () => {
  const event = webhookSchema.parse({
    id: "evt_1&2",
    event: "PAYMENT_RECEIVED",
    payment: { id: "pay_1", creditCard: { creditCardNumber: "sensitive" } },
    other: "ignore",
  });
  assert.deepEqual(event.payment, { id: "pay_1" });
  assert.equal(
    webhookSchema.safeParse({
      id: "evt",
      event: "PAYMENT_RECEIVED",
      checkout: { id: "x" },
    }).success,
    false,
  );
});
test("client targets Sandbox only, preserves auth server side, does not retry POST", async () => {
  let calls = 0;
  const client = new AsaasClient("test-key", async (url, init) => {
    calls++;
    assert.ok(String(url).startsWith("https://api-sandbox.asaas.com/v3/"));
    assert.equal(
      (init?.headers as Record<string, string>).access_token,
      "test-key",
    );
    throw new Error("timeout");
  });
  await assert.rejects(
    client.request("/checkouts", "POST", {}),
    (e: unknown) => e instanceof AsaasError && e.uncertain,
  );
  assert.equal(calls, 1);
  assert.ok(hostedCheckoutUrl("id").startsWith("https://sandbox.asaas.com/"));
});
test("definitive API rejection is distinct from uncertain server failures", async () => {
  for (const status of [400, 401, 429, 500]) {
    const client = new AsaasClient(
      "test",
      async () => new Response("{}", { status }),
    );
    await assert.rejects(
      client.request("/checkouts", "POST", {}),
      (e: unknown) =>
        e instanceof AsaasError &&
        e.uncertain === (status >= 500 || status === 429),
    );
  }
});
test("reconciliation reads all pages without leaking another checkout filter", async () => {
  let calls = 0;
  const client = new AsaasClient("test", async (url) => {
    const u = new URL(String(url));
    assert.equal(u.searchParams.get("checkoutSession"), "session_1");
    return Response.json({
      data: [{ id: `pay_${++calls}` }],
      hasMore: calls === 1,
    });
  });
  assert.equal(
    (await client.payments({ checkoutSession: "session_1" })).length,
    2,
  );
});
