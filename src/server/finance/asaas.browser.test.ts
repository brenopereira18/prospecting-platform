import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { recurringFixture } from "./recurring-test-fixture";
import { RecurringService } from "./recurring.service";
import { todayInSaoPaulo } from "./finance.schema";

test(
  "Asaas UI and webhook: private controls, explicit consent, keyboard/mobile and authenticated durable inbox",
  {
    skip: process.env.ASAAS_BROWSER_TEST !== "1",
    timeout: 240000,
  },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const fixture = await recurringFixture(db);
    const owner = fixture.users[0],
      session = randomUUID(),
      secret = randomUUID();
    const origin = "http://localhost:3105";
    const eventId = `evt_${randomUUID()}`;
    // A dedicated server with a fake provider key: this test cannot issue external charges.
    const server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", "3105"],
      {
        env: {
          ...process.env,
          ASAAS_ENVIRONMENT: "sandbox",
          ASAAS_SANDBOX_API_KEY: "test-key-no-external-payments",
          ASAAS_OWNER_USER_ID: owner,
          ASAAS_APP_URL: "https://example.invalid",
          ASAAS_WEBHOOK_TOKEN: secret,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let logs = "";
    server.stdout.on("data", (chunk) => {
      logs = (logs + String(chunk)).slice(-5000);
    });
    server.stderr.on("data", (chunk) => {
      logs = (logs + String(chunk)).slice(-5000);
    });
    const browser = await chromium.launch({ headless: true });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null)
          throw new Error(`Test server failed: ${logs}`);
        try {
          await fetch(origin + "/login");
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      assert.ok(ready, logs);
      await db.session.create({
        data: {
          userId: owner,
          tokenHash: createHash("sha256").update(session).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: "session",
          value: session,
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/dashboard`);
      await page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Financeiro", exact: true })
        .click();
      await page
        .getByRole("link")
        .filter({
          has: page.getByRole("heading", {
            name: fixture.sale.clientName,
            exact: true,
          }),
        })
        .click();
      await page
        .getByRole("button", { name: "Preparar checkout", exact: true })
        .click();
      await page
        .getByText("Pronto para compartilhar", { exact: true })
        .waitFor();
      const checkout = await db.asaasCheckout.findFirstOrThrow({
        where: { saleId: fixture.sale.id, contractId: null },
      });
      assert.equal(checkout.providerId, null);
      const paymentLink = page.getByRole("link", {
        name: "Abrir link de pagamento",
        exact: true,
      });
      assert.equal(
        await paymentLink.getAttribute("href"),
        `/pagamento/${checkout.publicToken}`,
      );
      await page
        .getByRole("link", {
          name: "Configuração e regras de parcelamento",
          exact: true,
        })
        .click();
      await page
        .getByRole("heading", { name: "Configurações", exact: true })
        .waitFor();
      await page.getByLabel("Limite geral de parcelas").fill("6");
      await page
        .getByRole("button", { name: "Salvar regras", exact: true })
        .click();
      await page.getByText("Operação concluída.").last().waitFor();
      assert.equal(
        (
          (await db.asaasPolicy.findUniqueOrThrow({ where: { userId: owner } }))
            .rules as { maxInstallments: number }
        ).maxInstallments,
        6,
      );
      await page
        .getByRole("link", { name: "Acessar vendas e contratos", exact: true })
        .click();
      await page
        .getByRole("link")
        .filter({
          has: page.getByRole("heading", {
            name: fixture.sale.clientName,
            exact: true,
          }),
        })
        .click();
      await page.screenshot({
        path: "/tmp/prospecta-asaas-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: "/tmp/prospecta-asaas-mobile.png",
        fullPage: true,
      });

      const contractId = randomUUID();
      await new RecurringService(db).create(
        {
          id: contractId,
          saleId: fixture.sale.id,
          startsOn: todayInSaoPaulo(),
          terms: {
            kind: "HOSPEDAGEM",
            description: "Hospedagem de teste",
            monthlyAmount: "99.90",
            dueDay: 28,
            paymentMethod: "CARTAO",
            notes: "",
          },
        },
        owner,
      );
      await page.reload();
      await page.getByRole("link", { name: /Hospedagem de teste/ }).click();
      await page
        .getByRole("button", {
          name: "Preparar contratação mensal",
          exact: true,
        })
        .click();
      await page
        .getByText("Pronto para compartilhar", { exact: true })
        .waitFor();
      const recurring = await db.asaasCheckout.findFirstOrThrow({
        where: { contractId },
      });
      const anonymous = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const publicPage = await anonymous.newPage();
      const publicPath = await page
        .getByRole("link", { name: "Abrir contratação mensal", exact: true })
        .getAttribute("href");
      assert.equal(publicPath, `/pagamento/${recurring.publicToken}`);
      const response = await publicPage.goto(`${origin}${publicPath}`);
      assert.equal(
        response?.status(),
        200,
        await publicPage.locator("body").innerText(),
      );
      const continueButton = publicPage.getByRole("button", {
        name: "Continuar no Asaas",
      });
      assert.ok(await continueButton.isDisabled());
      const consent = publicPage.getByRole("checkbox");
      await consent.focus();
      await publicPage.keyboard.press("Space");
      assert.ok(await continueButton.isEnabled());
      await publicPage.screenshot({
        path: "/tmp/prospecta-asaas-consent-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.equal(
        (
          await db.asaasCheckout.findUniqueOrThrow({
            where: { id: recurring.id },
          })
        ).acceptedAt,
        null,
      );
      await publicPage.goto(`${origin}/financeiro/vendas/${fixture.sale.id}`);
      await publicPage.waitForURL(/\/login/);

      const endpoint = origin + "/api/asaas/webhook";
      const body = JSON.stringify({
        id: eventId,
        event: "CHECKOUT_CREATED",
        checkout: { id: "checkout_ui_test", externalReference: checkout.id },
      });
      assert.equal(
        (await fetch(endpoint, { method: "POST", body })).status,
        401,
      );
      const headers = {
        "asaas-access-token": secret,
        "content-type": "application/json",
      };
      assert.equal(
        (
          await fetch(endpoint, {
            method: "POST",
            headers,
            body: "x".repeat(131073),
          })
        ).status,
        413,
      );
      assert.equal(
        (await fetch(endpoint, { method: "POST", headers, body: "{}" })).status,
        400,
      );
      const results = await Promise.all([
        fetch(endpoint, { method: "POST", headers, body }),
        fetch(endpoint, { method: "POST", headers, body }),
      ]);
      assert.ok(results.every((r) => r.status === 200));
      for (let n = 0; n < 40; n++) {
        if (
          (await db.asaasEvent.findUnique({ where: { id: eventId } }))
            ?.processedAt
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(await db.asaasEvent.count({ where: { id: eventId } }), 1);
      assert.ok(
        (await db.asaasEvent.findUniqueOrThrow({ where: { id: eventId } }))
          .processedAt,
      );
      assert.equal(
        await db.receipt.count({
          where: { receivable: { saleId: fixture.sale.id } },
        }),
        0,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (server.exitCode !== null) resolve();
        else server.once("exit", () => resolve());
      });
      await db.asaasEvent.deleteMany({ where: { id: eventId } });
      await db.asaasCheckout.deleteMany({ where: { saleId: fixture.sale.id } });
      await db.asaasPolicy.deleteMany({ where: { userId: owner } });
      await fixture.cleanup();
      await db.$disconnect();
    }
  },
);
