import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { ProposalService } from "../proposals/proposal.service";

test(
  "Chromium finance: explicit sale, partial payment, reversal, authorization and mobile",
  { skip: process.env.FINANCE_BROWSER_TEST !== "1", timeout: 180000 },
  async () => {
    const origin = process.env.FINANCE_UI_BASE_URL ?? "http://localhost:3102";
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const userId = randomUUID(),
      categoryId = randomUUID(),
      token = randomUUID();
    const browser = await chromium.launch({ headless: true });
    try {
      await db.user.create({
        data: {
          id: userId,
          name: "Teste Financeiro",
          email: `finance-ui-${userId}@example.invalid`,
          passwordHash: "test-only",
        },
      });
      await db.session.create({
        data: {
          userId,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await db.category.create({
        data: { id: categoryId, name: `Finance UI ${categoryId}` },
      });
      const lead = await db.lead.create({
        data: {
          userId,
          categoryId,
          name: "Hamburgueria Central",
          source: "MANUAL",
          status: "GANHO",
        },
      });
      const ps = new ProposalService(db);
      let proposal = await ps.create(
        {
          id: randomUUID(),
          leadId: lead.id,
          content: {
            title: "Site da Hamburgueria Central",
            description: "Página personalizada",
            scope: "Desenvolvimento e publicação",
            total: "1000",
            paymentMode: "A_NEGOCIAR",
            deposit: null,
            depositMethod: null,
            depositInstallments: null,
            balanceMethod: null,
            balanceInstallments: null,
            deliveryDays: 10,
            validUntil: "2027-01-01",
            notes: "",
            managedHosting: false,
            monthlyAmount: null,
            maintenance: "",
          },
        },
        userId,
      );
      for (const status of ["ENVIADA", "ACEITA"] as const)
        proposal = await ps.changeStatus(
          {
            id: proposal.id,
            leadId: lead.id,
            expectedRevision: proposal.revision,
            status,
          },
          userId,
        );
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: "session",
          value: token,
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/financeiro`);
      await page
        .getByRole("heading", { name: "Nenhuma venda registrada" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("navigation", { name: "Navegação principal" })
          .getByRole("link", { name: "Financeiro", exact: true })
          .count(),
        1,
      );
      await page.goto(`${origin}/leads/${lead.id}?tab=proposals`);
      const commercial = page.getByRole("region", {
        name: "Acompanhamento comercial",
      });
      const statusSelect = commercial.getByLabel("Status comercial", {
        exact: true,
      });
      const historySummary = commercial.locator("summary");
      await statusSelect.waitFor();
      const closedBar = await commercial.boundingBox();
      const labelBounds = await commercial.locator("label").boundingBox();
      const selectBounds = await statusSelect.boundingBox();
      assert.ok(
        closedBar && closedBar.height <= 76,
        "Compact desktop status bar",
      );
      assert.ok(
        labelBounds &&
          selectBounds &&
          selectBounds.x - labelBounds.x - labelBounds.width <= 20,
        "Status label stays beside select",
      );
      await statusSelect.selectOption("NOVO");
      await commercial
        .getByRole("button", { name: "Salvar alteração", exact: true })
        .waitFor();
      await page.setViewportSize({ width: 1024, height: 900 });
      const saveBounds = await commercial
        .getByRole("button", { name: "Salvar alteração", exact: true })
        .boundingBox();
      const historyBounds = await historySummary.boundingBox();
      assert.ok(
        saveBounds &&
          historyBounds &&
          saveBounds.x + saveBounds.width <= historyBounds.x,
        "Save does not overlap history",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await commercial
        .getByRole("button", { name: "Salvar alteração", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !document.querySelector(
            'form[aria-label="Alterar status comercial"] button[type="submit"]',
          ),
      );
      await statusSelect.selectOption("GANHO");
      await commercial
        .getByRole("button", { name: "Salvar alteração", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !document.querySelector(
            'form[aria-label="Alterar status comercial"] button[type="submit"]',
          ),
      );
      const currentLead = await db.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      assert.equal(currentLead.status, "GANHO");
      assert.equal(currentLead.statusRevision, 2);
      await historySummary.focus();
      await page.keyboard.press("Enter");
      const transitions = commercial.getByRole("list", {
        name: "Mudanças de status, mais recentes primeiro",
      });
      assert.equal(await transitions.locator("li").count(), 2);
      await historySummary.click();
      await commercial.screenshot({
        path: "/tmp/prospecta-commercial-toolbar-desktop.png",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await historySummary.click();
      await transitions.waitFor();
      await commercial.screenshot({
        path: "/tmp/prospecta-commercial-toolbar-mobile.png",
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await historySummary.click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("link", { name: "Registrar venda", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Registrar venda", exact: true })
        .waitFor();
      assert.equal(await db.sale.count({ where: { userId } }), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "/tmp/prospecta-finance-form-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      assert.equal(
        await page
          .getByLabel("Quantidade de parcelas", { exact: true })
          .count(),
        0,
      );
      await page
        .getByLabel("Forma de pagamento", { exact: true })
        .selectOption("CARTAO");
      await page
        .getByLabel("Quantidade de parcelas", { exact: true })
        .fill("2");
      await page
        .getByLabel("Forma de pagamento", { exact: true })
        .selectOption("PIX");
      assert.equal(
        await page
          .getByLabel("Quantidade de parcelas", { exact: true })
          .count(),
        0,
      );
      await page
        .getByLabel("Entrada (R$)", {
          exact: true,
        })
        .fill("200,00");
      await page
        .getByRole("button", { name: "Registrar venda", exact: true })
        .click();
      await page.waitForURL(/\/financeiro\/vendas\/[a-f0-9-]{36}$/);
      const saleId = page.url().split("/").at(-1)!;
      assert.equal(await db.sale.count({ where: { userId } }), 1);
      assert.equal(
        await db.receipt.count({ where: { receivable: { saleId } } }),
        0,
      );
      const firstAccount = page.locator('[id^="conta-"]').first();
      assert.equal(await page.locator("article").count(), 0);
      await firstAccount.locator("summary").first().waitFor();
      await page.screenshot({
        path: "/tmp/prospecta-finance-sale-desktop.png",
        fullPage: true,
      });
      await firstAccount.locator("summary").first().focus();
      await page.keyboard.press("Enter");
      await firstAccount
        .getByText("Registrar recebimento", { exact: true })
        .click();
      await firstAccount.getByLabel("Valor recebido (R$)").fill("50,00");
      await firstAccount
        .getByRole("button", { name: "Confirmar recebimento" })
        .click();
      await firstAccount.getByText("Parcial", { exact: true }).waitFor();
      assert.equal(
        await db.receipt.count({ where: { receivable: { saleId } } }),
        1,
      );
      assert.equal(
        await firstAccount
          .getByRole("button", { name: "Estornar recebimento" })
          .isVisible(),
        false,
      );
      await firstAccount
        .getByText("Histórico de recebimentos (1)", { exact: true })
        .click();
      await firstAccount
        .getByRole("button", { name: "Estornar recebimento" })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await db.receiptReversal.count({
          where: { receipt: { receivable: { saleId } } },
        }),
        0,
      );
      await firstAccount
        .getByRole("button", { name: "Estornar recebimento" })
        .click();
      await page
        .getByLabel("Motivo do estorno")
        .fill("Valor registrado incorretamente");
      await page.getByRole("button", { name: "Confirmar estorno" }).click();
      await firstAccount.getByText("Estornado", { exact: true }).waitFor();
      assert.equal(
        await db.receipt.count({ where: { receivable: { saleId } } }),
        1,
      );
      assert.equal(
        await db.receiptReversal.count({
          where: { receipt: { receivable: { saleId } } },
        }),
        1,
      );
      await page.reload();
      await firstAccount.locator("summary").first().click();
      await firstAccount
        .getByText("Histórico de recebimentos (1)", { exact: true })
        .click();
      await firstAccount.getByText("Estornado", { exact: true }).waitFor();
      await page.goto(`${origin}/financeiro`);
      await page
        .getByRole("heading", { name: "Hamburgueria Central", exact: true })
        .waitFor();
      assert.equal(
        await page.getByText("Venda registrada", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByText("Página 1", { exact: true }).count(),
        0,
      );
      await page.screenshot({
        path: "/tmp/prospecta-finance-desktop.png",
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "Contas a receber", exact: true })
        .click();
      await page.getByText("1 venda", { exact: true }).waitFor();
      const groups = page
        .getByRole("list", { name: "Vendas com contas a receber" })
        .locator(":scope > li");
      await groups.first().waitFor();
      assert.equal(await groups.count(), 1);
      assert.equal(
        await groups
          .getByRole("heading", { name: "Hamburgueria Central", exact: true })
          .count(),
        1,
      );
      await groups.locator("summary").first().focus();
      await page.keyboard.press("Enter");
      await groups
        .getByRole("heading", { name: "Contas desta venda", exact: true })
        .waitFor();
      const accountRows = groups.locator('[id^="conta-"]');
      assert.equal(await accountRows.count(), 2);
      assert.equal(await groups.locator("article").count(), 0);
      assert.ok(
        await accountRows.evaluateAll((rows) =>
          rows.every((row) => !(row as HTMLDetailsElement).open),
        ),
      );
      const entryAccount = accountRows.first();
      await entryAccount.locator("summary").first().focus();
      await page.keyboard.press("Enter");
      await entryAccount.getByText("Total recebido", { exact: true }).waitFor();
      assert.equal(
        await entryAccount.getByLabel("Valor recebido (R$)").isVisible(),
        false,
      );
      assert.equal(
        await entryAccount.getByText("Estornado", { exact: true }).isVisible(),
        false,
      );
      await entryAccount
        .getByText("Histórico de recebimentos (1)", { exact: true })
        .click();
      await entryAccount.getByText("Estornado", { exact: true }).waitFor();
      const balanceAccount = accountRows.nth(1);
      await balanceAccount.locator("summary").first().click();
      assert.equal(
        await balanceAccount.getByLabel("Valor recebido (R$)").isVisible(),
        false,
      );
      await balanceAccount
        .getByText("Registrar recebimento", { exact: true })
        .click();
      await balanceAccount.getByLabel("Valor recebido (R$)").fill("25,00");
      await balanceAccount
        .getByRole("button", { name: "Confirmar recebimento" })
        .click();
      await balanceAccount.getByText("Parcial", { exact: true }).waitFor();
      await groups
        .locator("summary")
        .first()
        .getByText("R$ 25,00", { exact: true })
        .waitFor();
      await groups
        .locator("summary")
        .first()
        .getByText("R$ 975,00", { exact: true })
        .waitFor();
      await entryAccount.locator("summary").first().click();
      await balanceAccount.locator("summary").first().click();
      for (const column of [
        "description",
        "due",
        "payment",
        "status",
        "balance",
      ]) {
        const header = await groups
          .locator(`[data-account-column="${column}"]`)
          .first()
          .boundingBox();
        for (const row of await accountRows.all()) {
          const cell = await row
            .locator("summary")
            .first()
            .locator(`[data-account-column="${column}"]`)
            .boundingBox();
          assert.ok(
            header && cell && Math.abs(header.x - cell.x) < 1,
            `Aligned ${column} column`,
          );
        }
      }
      for (const row of await accountRows.all()) {
        const bounds = await row.locator("summary").first().boundingBox();
        assert.ok(bounds && bounds.height <= 48, "Compact desktop row");
      }
      await page.locator("main").evaluate((element) => (element.scrollTop = 0));
      await page.screenshot({
        path: "/tmp/prospecta-accounts-group-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await groups.scrollIntoViewIfNeeded();
      for (const row of await accountRows.all()) {
        const bounds = await row.locator("summary").first().boundingBox();
        assert.ok(bounds && bounds.height <= 60, "Compact mobile row");
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.screenshot({
        path: "/tmp/prospecta-accounts-group-mobile.png",
        fullPage: true,
      });
      await entryAccount.locator("summary").first().click();
      await entryAccount.getByText("Estornado", { exact: true }).waitFor();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("link", { name: "Recebimentos", exact: true })
        .click();
      await page.getByText("Estornado", { exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      const financeSummary = page.locator('dl[aria-label="Resumo financeiro"]');
      const summaryBounds = await financeSummary.boundingBox();
      assert.ok(
        summaryBounds && summaryBounds.height < 170,
        "Compact mobile financial summary",
      );
      await page.screenshot({
        path: "/tmp/prospecta-finance-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.setViewportSize({ width: 768, height: 1024 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${origin}/financeiro/vendas/${saleId}`);
      await page
        .getByRole("heading", { name: "Contas a receber", exact: true })
        .waitFor();
      assert.equal(
        await page.getByText("Valor da venda", { exact: true }).count(),
        1,
      );
      assert.equal(
        await page.getByText("Total vendido", { exact: true }).count(),
        0,
      );
      assert.equal(await page.locator("article").count(), 0);
      assert.ok(
        await page
          .locator('[id^="conta-"]')
          .evaluateAll((rows) =>
            rows.every((row) => !(row as HTMLDetailsElement).open),
          ),
      );
      await page.screenshot({
        path: "/tmp/prospecta-finance-sale-mobile.png",
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.goto(`${origin}/leads/${lead.id}?tab=proposals`);
      await page.getByRole("link", { name: /Abrir venda/ }).waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Registrar venda", exact: true })
          .count(),
        0,
      );
      let fixedProposal = await ps.create(
        {
          id: randomUUID(),
          leadId: lead.id,
          content: {
            title: "Proposta com condições definidas",
            description: "Desenvolvimento",
            scope: "Página",
            total: "1000",
            paymentMode: "DEFINIDAS",
            deposit: "200",
            depositMethod: "PIX",
            depositInstallments: 1,
            balanceMethod: "CARTAO",
            balanceInstallments: 3,
            deliveryDays: 10,
            validUntil: "2027-01-01",
            notes: "",
            managedHosting: false,
            monthlyAmount: null,
            maintenance: "",
          },
        },
        userId,
      );
      for (const status of ["ENVIADA", "ACEITA"] as const)
        fixedProposal = await ps.changeStatus(
          {
            id: fixedProposal.id,
            leadId: lead.id,
            expectedRevision: fixedProposal.revision,
            status,
          },
          userId,
        );
      await page.goto(
        `${origin}/financeiro/vendas/nova?lead=${lead.id}&proposal=${fixedProposal.id}`,
      );
      await page
        .getByText("Cartão de crédito · 3 parcelas", { exact: true })
        .waitFor();
      assert.equal(
        await page.getByLabel("Forma de pagamento", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByLabel("Quantidade de parcelas", { exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByLabel("Entrada (R$)", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByLabel("Primeiro vencimento", { exact: true }).count(),
        2,
      );
      assert.equal(await db.sale.count({ where: { userId } }), 1);
      const anonymous = await browser.newContext();
      const anon = await anonymous.newPage();
      await anon.goto(`${origin}/financeiro/vendas/${saleId}`);
      await anon.waitForURL(/\/login/);
      await anonymous.close();
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close();
      const scope = { userId };
      await db.receiptReversal.deleteMany({
        where: { receipt: { receivable: { sale: scope } } },
      });
      await db.receipt.deleteMany({ where: { receivable: { sale: scope } } });
      await db.receivable.deleteMany({ where: { sale: scope } });
      await db.sale.deleteMany({ where: scope });
      await db.proposalStatusHistory.deleteMany({ where: { proposal: scope } });
      await db.commercialProposal.deleteMany({ where: scope });
      await db.user.deleteMany({ where: { id: userId } });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
