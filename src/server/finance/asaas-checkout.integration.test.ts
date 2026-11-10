import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { AsaasClient } from "./asaas.client";
import { AsaasService, ASAAS_EVENT_MAX_ATTEMPTS } from "./asaas.service";
import { recurringFixture } from "./recurring-test-fixture";
import { todayInSaoPaulo } from "./finance.schema";
import { RecurringService } from "./recurring.service";

test(
  "checkout lifecycle uses PostgreSQL and a fully mocked Asaas",
  {
    skip: process.env.FINANCE_DATABASE_TEST !== "1",
    timeout: 120000,
  },
  async (t) => {
    // These tests write disposable fixtures, never to a remotely configured DB.
    assert.ok(
      ["localhost", "127.0.0.1"].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      ),
    );
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    async function scenario(
      name: string,
      run: (s: Awaited<ReturnType<typeof setup>>) => Promise<void>,
    ) {
      await t.test(name, async () => {
        const s = await setup();
        try {
          await run(s);
        } finally {
          await s.cleanup();
        }
      });
    }
    async function setup() {
      const fixture = await recurringFixture(db);
      const user = fixture.users[0];
      const calls: { path: string; method: string }[] = [];
      const payments = new Map<string, unknown[]>();
      const events: string[] = [];
      let failRead = false;
      let onCreate: ((id: string) => Promise<void>) | undefined;
      let onPaymentsRead: (() => Promise<void>) | undefined;
      const api = new AsaasClient("mock-only-no-network", async (url, init) => {
        const u = new URL(String(url));
        const path = u.pathname.replace("/v3", "");
        calls.push({ path, method: init?.method ?? "GET" });
        if (path === "/checkouts") {
          const id = `mock_${randomUUID()}`;
          await onCreate?.(id);
          return Response.json({ id });
        }
        if (path === "/payments") {
          if (failRead) throw new Error("mock communication failure");
          const callback = onPaymentsRead;
          onPaymentsRead = undefined;
          await callback?.();
          return Response.json({
            data: payments.get(u.searchParams.get("checkoutSession")!) ?? [],
            hasMore: false,
          });
        }
        if (path.endsWith("/cancel")) return Response.json({});
        return Response.json({}, { status: 404 });
      });
      const config = {
        apiKey: "mock-only-no-network",
        ownerUserId: user,
        origin: "https://example.invalid",
        webhookToken: "a".repeat(40),
      };
      const service = new AsaasService(db, api, config);
      const prepare = () => service.prepare({ saleId: fixture.sale.id }, user);
      const get = (id: string) =>
        db.asaasCheckout.findUniqueOrThrow({ where: { id } });
      const active = async () => {
        const row = await prepare();
        await service.start(row.publicToken, false);
        return get(row.id);
      };
      const payload = (
        name: string,
        row: { id: string; providerId: string | null },
        includeReference = true,
      ) => {
        const id = `evt_${randomUUID()}`;
        events.push(id);
        return {
          id,
          event: name,
          checkout: {
            id: row.providerId!,
            ...(includeReference ? { externalReference: row.id } : {}),
          },
        };
      };
      return {
        fixture,
        user,
        service,
        api,
        config,
        calls,
        payments,
        prepare,
        active,
        get,
        payload,
        failRead: () => {
          failRead = true;
        },
        onCreate: (callback: (id: string) => Promise<void>) => {
          onCreate = callback;
        },
        onPaymentsRead: (callback: () => Promise<void>) => {
          onPaymentsRead = callback;
        },
        expireDeadline: (id: string) =>
          db.asaasCheckout.update({
            where: { id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          }),
        async cleanup() {
          await db.asaasEvent.deleteMany({ where: { id: { in: events } } });
          await db.receiptReversal.deleteMany({
            where: { receipt: { receivable: { saleId: fixture.sale.id } } },
          });
          await db.receipt.deleteMany({
            where: { receivable: { saleId: fixture.sale.id } },
          });
          await db.asaasPayment.deleteMany({
            where: { checkout: { saleId: fixture.sale.id } },
          });
          await db.asaasCheckout.deleteMany({
            where: { saleId: fixture.sale.id },
          });
          await fixture.cleanup();
        },
      };
    }
    try {
      await scenario(
        "ACTIVE is reused without a second checkout POST",
        async (s) => {
          const old = await s.active();
          assert.equal((await s.prepare()).id, old.id);
          await s.service.start(old.publicToken, false);
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            1,
          );
        },
      );
      await scenario(
        "EXPIRED webhook is idempotent and allows a new link without canceling",
        async (s) => {
          const old = await s.active();
          const event = s.payload("CHECKOUT_EXPIRED", old);
          await Promise.all([
            s.service.acceptEvent(event),
            s.service.acceptEvent(event),
          ]);
          assert.equal(
            await db.asaasEvent.count({ where: { id: event.id } }),
            1,
          );
          assert.ok(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .processedAt,
          );
          await s.service.cancel(old.id, s.user);
          const pair = await Promise.all([s.prepare(), s.prepare()]);
          assert.notEqual(pair[0].id, old.id);
          assert.equal(pair[0].id, pair[1].id);
          assert.notEqual(pair[0].publicToken, old.publicToken);
          assert.equal((await s.get(old.id)).status, "EXPIRED");
          assert.equal(
            s.calls.some((c) => c.path.endsWith("/cancel")),
            false,
          );
          const starts = await Promise.allSettled([
            s.service.start(pair[0].publicToken, false),
            s.service.start(pair[1].publicToken, false),
          ]);
          assert.ok(starts.some((result) => result.status === "fulfilled"));
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            2,
          );
        },
      );
      await scenario(
        "elapsed ACTIVE deadline with no remote payments expires on reconciliation",
        async (s) => {
          const old = await s.active();
          await s.expireDeadline(old.id);
          await s.service.cancel(old.id, s.user);
          assert.equal((await s.get(old.id)).status, "EXPIRED");
          assert.equal(
            s.calls.some((c) => c.path.endsWith("/cancel")),
            false,
          );
          assert.notEqual((await s.prepare()).id, old.id);
        },
      );
      await scenario(
        "expired local PREPARED link is replaced without remote calls",
        async (s) => {
          const old = await s.prepare();
          await s.expireDeadline(old.id);
          assert.notEqual((await s.prepare()).id, old.id);
          assert.equal((await s.get(old.id)).status, "EXPIRED");
          assert.equal(s.calls.length, 0);
        },
      );
      await scenario(
        "CANCELED link is preserved and can be explicitly replaced",
        async (s) => {
          const old = await s.active();
          await s.service.cancel(old.id, s.user);
          await s.service.cancel(old.id, s.user);
          assert.equal((await s.get(old.id)).status, "CANCELED");
          assert.notEqual((await s.prepare()).id, old.id);
          assert.equal(
            s.calls.filter((c) => c.path.endsWith("/cancel")).length,
            1,
          );
        },
      );
      await scenario(
        "PAID cannot be canceled, reopened or regressed by late expiration",
        async (s) => {
          const old = await s.active();
          await Promise.all([
            s.service.acceptEvent(s.payload("CHECKOUT_PAID", old)),
            s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old)),
          ]);
          await s.service.acceptEvent(s.payload("CHECKOUT_CANCELED", old));
          await s.expireDeadline(old.id);
          assert.equal((await s.get(old.id)).status, "PAID");
          assert.equal((await s.prepare()).id, old.id);
          await assert.rejects(s.service.cancel(old.id, s.user), /já foi pago/);
          await assert.rejects(
            s.service.start(old.publicToken, false),
            /já foi pago/,
          );
          assert.equal(
            s.calls.some((c) => c.path.endsWith("/cancel")),
            false,
          );
          assert.equal(
            await db.asaasCheckout.count({
              where: { saleId: s.fixture.sale.id },
            }),
            1,
          );
          assert.equal(
            await db.receipt.count({
              where: { receivable: { saleId: s.fixture.sale.id } },
            }),
            0,
          );
        },
      );
      for (const status of ["CONFIRMED", "PENDING", "AUTHORIZED"]) {
        await scenario(
          `${status} remote payment blocks replacement and cancellation`,
          async (s) => {
            const old = await s.active();
            await s.expireDeadline(old.id);
            s.payments.set(old.providerId!, [
              {
                id: `pay_${randomUUID()}`,
                status,
                billingType: "PIX",
                value: 1000,
                dueDate: todayInSaoPaulo(),
                checkoutSession: old.providerId,
              },
            ]);
            await assert.rejects(s.prepare(), /cobrança|pagamento/);
            await assert.rejects(
              s.service.cancel(old.id, s.user),
              /cobrança|pagamento/,
            );
            assert.equal((await s.get(old.id)).status, "ACTIVE");
            assert.equal(
              s.calls.some((c) => c.path.endsWith("/cancel")),
              false,
            );
            assert.equal(
              await db.receipt.count({
                where: { receivable: { saleId: s.fixture.sale.id } },
              }),
              0,
            );
          },
        );
      }
      await scenario(
        "communication failure preserves the old link and prevents new issuance",
        async (s) => {
          const old = await s.active();
          await s.expireDeadline(old.id);
          s.failRead();
          await assert.rejects(s.prepare(), /não confirmou/);
          await assert.rejects(
            s.service.cancel(old.id, s.user),
            /não confirmou/,
          );
          assert.equal((await s.get(old.id)).status, "ACTIVE");
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            1,
          );
        },
      );
      await scenario(
        "late CREATED cannot resurrect an expired checkout",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          await s.service.acceptEvent(s.payload("CHECKOUT_CREATED", old));
          assert.equal((await s.get(old.id)).status, "EXPIRED");
        },
      );
      await scenario(
        "pending PAID event blocks preparing or starting another checkout",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.prepare();
          await s.service.storeEvent(s.payload("CHECKOUT_PAID", old));
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pagamento|cobrança/,
          );
          assert.equal((await s.get(next.id)).status, "PREPARED");
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            1,
          );
        },
      );
      await scenario(
        "other users cannot cancel, reconcile or prepare this sale",
        async (s) => {
          const old = await s.active();
          for (const user of ["", s.fixture.users[1]]) {
            await assert.rejects(
              s.service.prepare({ saleId: s.fixture.sale.id }, user),
            );
            await assert.rejects(s.service.reconcile(old.id, user));
            await assert.rejects(s.service.cancel(old.id, user));
          }
          assert.equal((await s.get(old.id)).status, "ACTIVE");
        },
      );
      await scenario(
        "late PAID coexists with a replacement and blocks all URL delivery",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.active();
          s.payments.set(old.providerId!, [
            {
              id: `pay_${randomUUID()}`,
              status: "RECEIVED",
              billingType: "PIX",
              value: 1000,
              originalValue: 1000,
              netValue: 998,
              dueDate: todayInSaoPaulo(),
              creditDate: todayInSaoPaulo(),
              checkoutSession: old.providerId,
            },
          ]);
          const paid = s.payload("CHECKOUT_PAID", old);
          await Promise.all([
            s.service.acceptEvent(paid),
            s.service.acceptEvent(paid),
          ]);
          assert.equal((await s.get(old.id)).status, "PAID");
          assert.equal((await s.get(next.id)).status, "ACTIVE");
          assert.ok(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: paid.id } }))
              .processedAt,
          );
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pago|pagamento/,
          );
          await assert.rejects(s.prepare(), /pago|pagamento/);
          assert.match(
            (await s.service.publicCheckout(next.publicToken)).blockedReason!,
            /pago|pagamento/,
          );
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          assert.equal((await s.get(old.id)).status, "PAID");
          await s.service.acceptEvent(s.payload("CHECKOUT_PAID", old));
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            2,
          );
          assert.equal(
            await db.receipt.count({
              where: { receivable: { saleId: s.fixture.sale.id } },
            }),
            1,
          );
          assert.equal(
            (
              await db.receipt.aggregate({
                where: { receivable: { saleId: s.fixture.sale.id } },
                _sum: { amount: true },
              })
            )._sum.amount?.toFixed(2),
            "1000.00",
          );
        },
      );
      await scenario(
        "pending older payment blocks reuse of an already ACTIVE replacement",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.active();
          await s.service.syncPayment({
            id: `pay_${randomUUID()}`,
            status: "PENDING",
            billingType: "PIX",
            value: 1000,
            dueDate: todayInSaoPaulo(),
            checkoutSession: old.providerId,
          });
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pagamento|cobrança/,
          );
          await assert.rejects(s.prepare(), /pagamento|cobrança/);
          assert.ok(
            (await s.service.publicCheckout(next.publicToken)).blockedReason,
          );
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            2,
          );
        },
      );
      await scenario(
        "paid notification arriving during remote creation prevents returning its URL",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.prepare();
          s.onCreate(async () => {
            await s.service.storeEvent(s.payload("CHECKOUT_PAID", old));
          });
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pagamento|cobrança/,
          );
          assert.equal((await s.get(next.id)).status, "ACTIVE");
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pagamento|cobrança/,
          );
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            2,
          );
        },
      );
      await scenario(
        "unassociated event has backoff, bounded attempts and explicit recovery",
        async (s) => {
          const local = await s.prepare();
          let providerId = "";
          s.onCreate(async (id) => {
            providerId = id;
            throw new Error("mock lost creation response");
          });
          await assert.rejects(s.service.start(local.publicToken, false));
          assert.equal((await s.get(local.id)).status, "UNKNOWN");
          const event = s.payload(
            "CHECKOUT_CREATED",
            { id: local.id, providerId },
            false,
          );
          const attempts = await Promise.allSettled([
            s.service.acceptEvent(event),
            s.service.acceptEvent(event),
          ]);
          assert.equal(
            attempts.filter((a) => a.status === "rejected").length,
            1,
          );
          let saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.equal(saved.attempts, 1);
          assert.equal(saved.processedAt, null);
          assert.ok(saved.nextAttemptAt! > new Date());
          await s.service.acceptEvent(event);
          await s.service.retryEvents(s.user);
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .attempts,
            1,
          );
          for (let n = 1; n < ASAAS_EVENT_MAX_ATTEMPTS; n++) {
            await db.asaasEvent.update({
              where: { id: event.id },
              data: { nextAttemptAt: new Date(0) },
            });
            await assert.rejects(
              s.service.processEvent(event.id),
              /associação/,
            );
          }
          saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.equal(saved.attempts, ASAAS_EVENT_MAX_ATTEMPTS);
          assert.equal(saved.processedAt, null);
          assert.ok(saved.failedAt);
          assert.equal(saved.nextAttemptAt, null);
          assert.equal(await s.service.failedEventsCount(s.user), 1);
          await s.service.retryEvents(s.user);
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .attempts,
            ASAAS_EVENT_MAX_ATTEMPTS,
          );
          // A corrected resend can enrich correlation without changing the event ID.
          await s.service.storeEvent({
            ...event,
            checkout: { ...event.checkout, externalReference: local.id },
          });
          const recovered = await s.service.retryEvents(s.user, true);
          assert.equal(recovered.processed, 1);
          saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.ok(saved.processedAt);
          assert.equal(saved.failedAt, null);
          assert.equal(saved.attempts, ASAAS_EVENT_MAX_ATTEMPTS + 1);
          assert.equal((await s.get(local.id)).status, "ACTIVE");
          await s.service.acceptEvent(event);
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .attempts,
            saved.attempts,
          );
        },
      );
      await scenario(
        "database constraint rejects a second available checkout even without the service",
        async (s) => {
          const row = await s.active();
          await assert.rejects(
            db.asaasCheckout.create({
              data: {
                saleId: s.fixture.sale.id,
                publicToken: randomUUID().replaceAll("-", "").repeat(2),
                status: "ACTIVE",
                amount: row.amount,
                terms: row.terms!,
                expiresAt: new Date(Date.now() + 60000),
              },
            }),
            (error: unknown) => (error as { code?: string }).code === "P2002",
          );
          assert.equal(
            await db.asaasCheckout.count({
              where: { saleId: s.fixture.sale.id },
            }),
            1,
          );
        },
      );
      await scenario(
        "remote confirmed payment blocks ACTIVE reuse even before its webhook",
        async (s) => {
          const old = await s.active();
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.active();
          s.payments.set(old.providerId!, [
            {
              id: `pay_${randomUUID()}`,
              status: "CONFIRMED",
              billingType: "CREDIT_CARD",
              value: 1000,
              dueDate: todayInSaoPaulo(),
              checkoutSession: old.providerId,
            },
          ]);
          await assert.rejects(
            s.service.start(next.publicToken, false),
            /pagamento|cobrança/,
          );
          assert.equal(
            await db.receipt.count({
              where: { receivable: { saleId: s.fixture.sale.id } },
            }),
            0,
          );
        },
      );
      await scenario(
        "paid event during an empty reconciliation prevents expiration and cancellation",
        async (s) => {
          const row = await s.active();
          await s.expireDeadline(row.id);
          s.onPaymentsRead(async () => {
            await s.service.storeEvent(s.payload("CHECKOUT_PAID", row));
          });
          await s.service.reconcile(row.id, s.user);
          assert.equal((await s.get(row.id)).status, "ACTIVE");
          await assert.rejects(
            s.service.cancel(row.id, s.user),
            /pagamento|notificação/,
          );
          assert.equal(
            s.calls.some((c) => c.path.endsWith("/cancel")),
            false,
          );
          await assert.rejects(s.prepare(), /pagamento|cobrança/);
        },
      );
      await scenario(
        "lost DB result is UNKNOWN, never reposted, and recovered by correlated webhook",
        async (s) => {
          let fail = true;
          let providerId = "";
          s.onCreate(async (id) => {
            providerId = id;
          });
          const delegate = new Proxy(db.asaasCheckout, {
            get(target, key) {
              if (key === "updateMany")
                return async (
                  args: Parameters<typeof target.updateMany>[0],
                ) => {
                  if (fail && args?.data.status === "ACTIVE") {
                    fail = false;
                    throw new Error("mock result persistence failure");
                  }
                  return target.updateMany(args);
                };
              const value = Reflect.get(target, key);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const wrapped = new Proxy(db, {
            get(target, key) {
              if (key === "asaasCheckout") return delegate;
              const value = Reflect.get(target, key);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const service = new AsaasService(wrapped, s.api, s.config);
          const row = await service.prepare(
            { saleId: s.fixture.sale.id },
            s.user,
          );
          await assert.rejects(service.start(row.publicToken, false));
          assert.equal((await s.get(row.id)).status, "UNKNOWN");
          assert.equal(
            (await service.prepare({ saleId: s.fixture.sale.id }, s.user)).id,
            row.id,
          );
          await assert.rejects(service.start(row.publicToken, false));
          assert.equal(
            s.calls.filter((c) => c.path === "/checkouts").length,
            1,
          );
          await service.acceptEvent(
            s.payload("CHECKOUT_CREATED", { id: row.id, providerId }),
          );
          assert.equal((await s.get(row.id)).status, "ACTIVE");
        },
      );
      await scenario(
        "event ownership prevents recovery or consumption by another integration owner",
        async (s) => {
          const event = s.payload(
            "CHECKOUT_CREATED",
            { id: randomUUID(), providerId: `unknown_${randomUUID()}` },
            false,
          );
          await assert.rejects(s.service.acceptEvent(event));
          const other = new AsaasService(db, s.api, {
            ...s.config,
            ownerUserId: s.fixture.users[1],
          });
          await assert.rejects(other.processEvent(event.id));
          await assert.rejects(other.storeEvent(event));
          assert.equal(
            (await other.retryEvents(s.fixture.users[1])).processed,
            0,
          );
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .userId,
            s.user,
          );
        },
      );
      await scenario(
        "legacy orphan is reopened only after a verified association and stays idempotent",
        async (s) => {
          const row = await s.prepare();
          let providerId = "";
          s.onCreate(async (id) => {
            providerId = id;
            throw new Error("mock lost response");
          });
          await assert.rejects(s.service.start(row.publicToken, false));
          const event = s.payload(
            "CHECKOUT_CREATED",
            { id: row.id, providerId },
            false,
          );
          await db.asaasEvent.create({
            data: {
              id: event.id,
              event: event.event,
              resourceId: providerId,
              processedAt: new Date(0),
            },
          });
          await assert.rejects(s.service.storeEvent(event), /divergente/);
          const corrected = {
            ...event,
            checkout: { ...event.checkout, externalReference: row.id },
          };
          await s.service.storeEvent(corrected);
          let saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.equal(saved.userId, s.user);
          assert.equal(saved.processedAt, null);
          await s.service.processEvent(event.id);
          saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.ok(saved.processedAt);
          await s.service.acceptEvent(corrected);
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .attempts,
            saved.attempts,
          );
          assert.equal((await s.get(row.id)).status, "ACTIVE");
        },
      );
      await scenario(
        "an interrupted last attempt cannot bypass the automatic retry limit",
        async (s) => {
          const event = s.payload(
            "CHECKOUT_CREATED",
            { id: randomUUID(), providerId: `orphan_${randomUUID()}` },
            false,
          );
          await s.service.storeEvent(event);
          await db.asaasEvent.update({
            where: { id: event.id },
            data: {
              attempts: ASAAS_EVENT_MAX_ATTEMPTS,
              nextAttemptAt: new Date(0),
            },
          });
          const result = await s.service.retryEvents(s.user);
          assert.equal(result.processed, 0);
          assert.equal(result.failed, 1);
          const saved = await db.asaasEvent.findUniqueOrThrow({
            where: { id: event.id },
          });
          assert.equal(saved.attempts, ASAAS_EVENT_MAX_ATTEMPTS);
          assert.ok(saved.failedAt);
          await s.service.processEvent(event.id);
          assert.equal(
            (await db.asaasEvent.findUniqueOrThrow({ where: { id: event.id } }))
              .attempts,
            ASAAS_EVENT_MAX_ATTEMPTS,
          );
        },
      );
      await scenario(
        "contract constraint allows historical PAID but only one available checkout",
        async (s) => {
          const id = randomUUID();
          await new RecurringService(db).create(
            {
              id,
              saleId: s.fixture.sale.id,
              startsOn: todayInSaoPaulo(),
              terms: {
                kind: "HOSPEDAGEM",
                description: "Contrato de teste",
                monthlyAmount: "99.90",
                dueDay: 28,
                paymentMethod: "CARTAO",
                notes: "",
              },
            },
            s.user,
          );
          const first = await s.service.prepare(
            { saleId: s.fixture.sale.id, contractId: id },
            s.user,
          );
          await s.service.start(first.publicToken, true);
          const old = await s.get(first.id);
          await s.service.acceptEvent(s.payload("CHECKOUT_EXPIRED", old));
          const next = await s.service.prepare(
            { saleId: s.fixture.sale.id, contractId: id },
            s.user,
          );
          await s.service.start(next.publicToken, true);
          await s.service.acceptEvent(s.payload("CHECKOUT_PAID", old));
          assert.equal((await s.get(old.id)).status, "PAID");
          assert.equal((await s.get(next.id)).status, "ACTIVE");
          await assert.rejects(
            s.service.start(next.publicToken, true),
            /pago|pagamento/,
          );
          await assert.rejects(
            db.asaasCheckout.create({
              data: {
                saleId: s.fixture.sale.id,
                contractId: id,
                publicToken: randomUUID().replaceAll("-", "").repeat(2),
                status: "ACTIVE",
                amount: old.amount,
                terms: old.terms!,
                expiresAt: new Date(Date.now() + 60000),
              },
            }),
            (error: unknown) => (error as { code?: string }).code === "P2002",
          );
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
