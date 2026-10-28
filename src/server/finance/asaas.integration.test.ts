import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { AsaasService } from "./asaas.service";
import { AsaasClient } from "./asaas.client";
import { RecurringService } from "./recurring.service";
import { FinanceService } from "./finance.service";
import { todayInSaoPaulo } from "./finance.schema";
import { recurringFixture } from "./recurring-test-fixture";

test(
  "Asaas integrates with PostgreSQL ledger using mocked provider",
  { skip: process.env.FINANCE_DATABASE_TEST !== "1", timeout: 120000 },
  async (t) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const f = await recurringFixture(db);
    const [user, other] = f.users;
    const requests: {
      path: string;
      method: string;
      body: Record<string, unknown>;
    }[] = [];
    const responses = new Map<string, unknown>();
    const eventIds: string[] = [];
    let failCreate = false;
    let failSubscriptionChange = false;
    const api = new AsaasClient("mock", async (url, init) => {
      const u = new URL(String(url)),
        path = u.pathname.replace("/v3", "");
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      requests.push({ path, method: init?.method ?? "GET", body });
      if (
        path.startsWith("/subscriptions/") &&
        init?.method === "PUT" &&
        failSubscriptionChange
      )
        return Response.json({ errors: [] }, { status: 503 });
      if (path === "/checkouts" && init?.method === "POST") {
        if (failCreate) throw new Error("timeout");
        return Response.json({ id: `checkout_${requests.length}` });
      }
      if (path === "/payments")
        return Response.json({
          data:
            responses.get(
              u.searchParams.get("checkoutSession") ??
                u.searchParams.get("subscription") ??
                "",
            ) ?? [],
          hasMore: false,
        });
      if (
        init?.method === "DELETE" ||
        init?.method === "PUT" ||
        path.endsWith("/cancel")
      )
        return Response.json({ deleted: true });
      if (responses.has(path)) return Response.json(responses.get(path));
      return Response.json({ errors: [] }, { status: 404 });
    });
    const config = {
      apiKey: "mock",
      ownerUserId: user,
      origin: "https://prospecta.example",
      webhookToken: "a".repeat(40),
    };
    const service = new AsaasService(db, api, config);
    const recurring = new RecurringService(db);
    const finance = new FinanceService(db);
    const today = todayInSaoPaulo();
    const event = async (
      name: string,
      resource: "checkout" | "payment" | "subscription",
      id: string,
      extra = {},
    ) => {
      const eid = `evt_${randomUUID()}`;
      eventIds.push(eid);
      await service.acceptEvent({
        id: eid,
        event: name,
        [resource]: { id, ...extra },
      });
      return eid;
    };
    let checkout: Awaited<ReturnType<typeof service.prepare>>;
    let contractId = "";
    try {
      await t.test("owner isolation and policy validation", async () => {
        await assert.rejects(service.prepare({ saleId: f.sale.id }, other));
        await assert.rejects(service.prepare({ saleId: f.sale.id }, ""));
        await assert.rejects(service.prepare({ saleId: randomUUID() }, user));
        await service.savePolicy(
          {
            maxInstallments: 12,
            minInstallment: "5.00",
            costMode: "SELLER",
            bands: [{ from: "500.00", maxInstallments: 6 }],
          },
          user,
        );
      });
      await t.test(
        "concurrent preparation creates only one checkout and no receipt",
        async () => {
          const pair = await Promise.all([
            service.prepare({ saleId: f.sale.id }, user),
            service.prepare({ saleId: f.sale.id }, user),
          ]);
          assert.equal(pair[0].id, pair[1].id);
          checkout = pair[0];
          assert.equal(
            await db.receipt.count({
              where: { receivable: { saleId: f.sale.id } },
            }),
            0,
          );
        },
      );
      await t.test(
        "hosted checkout offers Pix, card at sight and bounded installments without surcharges",
        async () => {
          const url = await service.start(checkout.publicToken, false);
          assert.ok(
            url.startsWith(
              "https://sandbox.asaas.com/checkoutSession/show?id=",
            ),
          );
          const request = requests.find((r) => r.path === "/checkouts")!;
          assert.deepEqual(request.body.billingTypes, ["PIX", "CREDIT_CARD"]);
          assert.deepEqual(request.body.chargeTypes, [
            "DETACHED",
            "INSTALLMENT",
          ]);
          assert.deepEqual(request.body.installment, {
            maxInstallmentCount: 6,
          });
          assert.equal(await service.start(checkout.publicToken, false), url);
          assert.equal(
            requests.filter((r) => r.path === "/checkouts").length,
            1,
          );
          checkout = await db.asaasCheckout.findUniqueOrThrow({
            where: { id: checkout.id },
          });
        },
      );
      const payment = (id: string, value: number, status = "RECEIVED") => ({
        id,
        status,
        billingType: "CREDIT_CARD",
        value,
        originalValue: value,
        netValue: value - 2,
        dueDate: today,
        paymentDate: today,
        checkoutSession: checkout.providerId,
        installment: "ins_1",
        installmentNumber: 1,
      });
      await t.test(
        "confirmed or refused card does not post receipt; duplicate events settle once",
        async () => {
          const p = payment("pay_test_first", 400, "CONFIRMED");
          responses.set(`/payments/${p.id}`, p);
          await event("PAYMENT_CONFIRMED", "payment", p.id);
          assert.equal(
            await db.receipt.count({ where: { asaasPaymentId: p.id } }),
            0,
          );
          responses.set(`/payments/${p.id}`, { ...p, status: "PENDING" });
          await event("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "payment", p.id);
          assert.equal(
            await db.receipt.count({ where: { asaasPaymentId: p.id } }),
            0,
          );
          responses.set(`/payments/${p.id}`, {
            ...p,
            status: "RECEIVED",
            paymentDate: "2024-01-01",
            creditDate: today,
          });
          const eid = `evt_${randomUUID()}`;
          eventIds.push(eid);
          const payload = {
            id: eid,
            event: "PAYMENT_RECEIVED",
            payment: { id: p.id },
          };
          await Promise.all([
            service.acceptEvent(payload),
            service.acceptEvent(payload),
          ]);
          assert.equal(
            await db.receipt.count({ where: { asaasPaymentId: p.id } }),
            1,
          );
          const stored = await db.asaasPayment.findUniqueOrThrow({
            where: { id: p.id },
          });
          assert.equal(stored.providerFee!.toFixed(2), "2.00");
          assert.equal(stored.netAmount!.toFixed(2), "398.00");
          const receipt = await db.receipt.findFirstOrThrow({
            where: { asaasPaymentId: p.id },
          });
          assert.equal(receipt.receivedOn.toISOString().slice(0, 10), today);
        },
      );
      await t.test(
        "Pix settlement finishes existing receivable; no duplicate ledger",
        async () => {
          const p = {
            ...payment("pay_test_second", 600),
            billingType: "PIX",
            installment: null,
          };
          responses.set(`/payments/${p.id}`, p);
          await event("PAYMENT_RECEIVED", "payment", p.id);
          const sale = await finance.get(f.sale.id, user);
          assert.equal(sale.receivables[0].outstanding, "0.00");
          assert.equal(sale.receivables.length, 1);
        },
      );
      await t.test(
        "refund appends reversal; stale events cannot resurrect receipt",
        async () => {
          const p = payment("pay_test_first", 400, "REFUNDED");
          responses.set(`/payments/${p.id}`, p);
          await event("PAYMENT_REFUNDED", "payment", p.id);
          assert.equal(
            (await finance.get(f.sale.id, user)).receivables[0].outstanding,
            "400.00",
          );
          await service.syncPayment({ ...p, status: "RECEIVED" });
          assert.equal(
            (await finance.get(f.sale.id, user)).receivables[0].outstanding,
            "400.00",
          );
          const r = await db.receipt.findFirstOrThrow({
            where: { asaasPaymentId: p.id },
          });
          await assert.rejects(
            finance.reverse({ receiptId: r.id, reason: "manual" }, user),
          );
        },
      );
      await t.test(
        "financial posting failure rolls back all allocations",
        async () => {
          const p = payment("pay_test_excess", 900);
          responses.set(`/payments/${p.id}`, p);
          await assert.rejects(event("PAYMENT_RECEIVED", "payment", p.id));
          assert.equal(
            await db.receipt.count({ where: { asaasPaymentId: p.id } }),
            0,
          );
          assert.equal(await db.asaasPayment.count({ where: { id: p.id } }), 0);
          assert.equal(
            (await finance.get(f.sale.id, user)).receivables[0].outstanding,
            "400.00",
          );
        },
      );
      await t.test(
        "subscription requires separate explicit consent and records agreed terms",
        async () => {
          contractId = randomUUID();
          await recurring.create(
            {
              id: contractId,
              saleId: f.sale.id,
              startsOn: today,
              terms: {
                kind: "HOSPEDAGEM",
                description: "Hospedagem teste",
                monthlyAmount: "99.90",
                dueDay: 28,
                paymentMethod: "CARTAO",
                notes: "",
              },
            },
            user,
          );
          const c = await service.prepare(
            { saleId: f.sale.id, contractId },
            user,
          );
          await assert.rejects(service.start(c.publicToken, false));
          await assert.rejects(
            service.start(c.publicToken, "true" as unknown as boolean),
          );
          assert.equal(
            (await db.asaasCheckout.findUniqueOrThrow({ where: { id: c.id } }))
              .acceptedAt,
            null,
          );
          await service.start(c.publicToken, true);
          const saved = await db.asaasCheckout.findUniqueOrThrow({
            where: { id: c.id },
          });
          assert.ok(saved.acceptedAt);
          const request = requests
            .filter((r) => r.path === "/checkouts")
            .at(-1)!;
          assert.deepEqual(request.body.chargeTypes, ["RECURRENT"]);
          assert.deepEqual(request.body.billingTypes, ["CREDIT_CARD"]);
          const sub = "sub_test";
          responses.set(`/subscriptions/${sub}`, {
            id: sub,
            status: "ACTIVE",
            value: 99.9,
            cycle: "MONTHLY",
            externalReference: c.id,
          });
          await event("SUBSCRIPTION_CREATED", "subscription", sub);
          const p = {
            id: "pay_test_month",
            status: "PENDING",
            billingType: "CREDIT_CARD",
            value: 99.9,
            netValue: 97.9,
            dueDate: today,
            subscription: sub,
          };
          responses.set(`/payments/${p.id}`, p);
          await event("PAYMENT_CREATED", "payment", p.id);
          let details = await recurring.get(contractId, user);
          assert.equal(details.receivables.length, 1);
          assert.equal(details.receivables[0].received, "0.00");
          responses.set(`/payments/${p.id}`, {
            ...p,
            status: "RECEIVED",
            paymentDate: today,
          });
          await event("PAYMENT_RECEIVED", "payment", p.id);
          details = await recurring.get(contractId, user);
          assert.equal(details.receivables[0].received, "99.90");
          await assert.rejects(
            recurring.generate(
              {
                id: contractId,
                expectedRevision: 0,
                competence: today.slice(0, 7),
              },
              user,
            ),
          );
        },
      );
      await t.test(
        "suspend and reactivate synchronize provider before local history",
        async () => {
          await service.changeContractStatus(
            {
              id: contractId,
              expectedRevision: 0,
              status: "SUSPENSO",
              reason: "Pausa solicitada",
            },
            user,
          );
          assert.equal(
            (await recurring.get(contractId, user)).status,
            "SUSPENSO",
          );
          await service.changeContractStatus(
            {
              id: contractId,
              expectedRevision: 1,
              status: "ATIVO",
              reason: "Retomada solicitada",
            },
            user,
          );
          assert.equal((await recurring.get(contractId, user)).status, "ATIVO");
          const changes = requests.filter(
            (r) => r.path === "/subscriptions/sub_test" && r.method === "PUT",
          );
          assert.deepEqual(
            changes.map((r) => r.body.status),
            ["INACTIVE", "ACTIVE"],
          );
          assert.ok(
            changes.every((r) => r.body.updatePendingPayments === false),
          );
        },
      );
      await t.test(
        "uncertain subscription change preserves local status and prevents duplicate requests",
        async () => {
          failSubscriptionChange = true;
          const cmd = {
            id: contractId,
            expectedRevision: 2,
            status: "SUSPENSO",
            reason: "Pausa",
          };
          await assert.rejects(service.changeContractStatus(cmd, user));
          const before = requests.length;
          await assert.rejects(service.changeContractStatus(cmd, user));
          assert.equal(requests.length, before);
          assert.equal((await recurring.get(contractId, user)).status, "ATIVO");
          failSubscriptionChange = false;
          await db.asaasCheckout.updateMany({
            where: { contractId },
            data: { requestedAt: new Date(Date.now() - 91000) },
          });
          await service.syncSubscription("sub_test", true);
        },
      );
      await t.test(
        "cancel first stops external recurrence, preserves receipts and local history",
        async () => {
          await assert.rejects(
            recurring.changeStatus(
              {
                id: contractId,
                expectedRevision: 2,
                status: "CANCELADO",
                reason: "Cancelamento",
              },
              user,
            ),
          );
          await service.changeContractStatus(
            {
              id: contractId,
              expectedRevision: 2,
              status: "CANCELADO",
              reason: "Cliente solicitou",
            },
            user,
          );
          assert.ok(
            requests.some(
              (r) =>
                r.path === "/subscriptions/sub_test" && r.method === "DELETE",
            ),
          );
          const c = await recurring.get(contractId, user);
          assert.equal(c.status, "CANCELADO");
          assert.equal(c.receivables[0].received, "99.90");
          assert.equal(c.history.length, 4);
        },
      );
      await t.test(
        "timeout is retained as UNKNOWN, never automatically reposted",
        async () => {
          await service.cancel(checkout.id, user);
          failCreate = true;
          const c = await service.prepare({ saleId: f.sale.id }, user);
          const before = requests.filter((r) => r.path === "/checkouts").length;
          await assert.rejects(service.start(c.publicToken, false));
          assert.equal(
            (await db.asaasCheckout.findUniqueOrThrow({ where: { id: c.id } }))
              .status,
            "UNKNOWN",
          );
          await assert.rejects(service.start(c.publicToken, false));
          assert.equal(
            requests.filter((r) => r.path === "/checkouts").length,
            before + 1,
          );
        },
      );
    } finally {
      await db.asaasEvent.deleteMany({ where: { id: { in: eventIds } } });
      await db.receiptReversal.deleteMany({
        where: { receipt: { receivable: { saleId: f.sale.id } } },
      });
      await db.receipt.deleteMany({
        where: { receivable: { saleId: f.sale.id } },
      });
      await db.asaasPayment.deleteMany({
        where: { checkout: { saleId: f.sale.id } },
      });
      await db.asaasCheckout.deleteMany({ where: { saleId: f.sale.id } });
      await db.asaasPolicy.deleteMany({ where: { userId: user } });
      await f.cleanup();
      await db.$disconnect();
    }
  },
);
