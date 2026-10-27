import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { recurringFixture } from "./recurring-test-fixture";
import { todayInSaoPaulo } from "./finance.schema";
import { RecurringService } from "./recurring.service";

test(
  "Chromium: contracts, monthly charges and reused payment controls work on desktop and mobile",
  { skip: process.env.FINANCE_BROWSER_TEST !== "1", timeout: 180000 },
  async () => {
    const origin = process.env.FINANCE_UI_BASE_URL ?? "http://localhost:3102";
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const fixture = await recurringFixture(db);
    const browser = await chromium.launch({ headless: true });
    try {
      const token = randomUUID();
      await db.session.create({
        data: {
          userId: fixture.users[0],
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
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
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/financeiro/vendas/${fixture.sale.id}`);
      await page.getByRole("link", { name: "Cadastrar contrato" }).click();
      const form = page.getByRole("form", { name: "Cadastrar contrato" });
      await form
        .getByLabel("Valor mensal (R$)", { exact: true })
        .fill("100,01");
      await form
        .getByLabel("Data de início", { exact: true })
        .fill(`${todayInSaoPaulo().slice(0, 7)}-01`);
      await form
        .getByLabel("Serviços incluídos", { exact: true })
        .fill("Hospedagem gerenciada e manutenção");
      await form
        .getByRole("button", { name: "Cadastrar contrato", exact: true })
        .click();
      await page.waitForURL(/\/financeiro\/contratos\/[a-f0-9-]{36}$/);
      const contractUrl = page.url();
      await page
        .getByRole("heading", { name: fixture.lead.name, exact: true })
        .waitFor();
      const generation = page.getByRole("form", { name: "Gerar mensalidade" });
      await generation
        .getByRole("button", { name: "Gerar mensalidade", exact: true })
        .click();
      await generation.getByRole("status").waitFor();
      const account = page.locator('details[id^="conta-"]').first();
      await account.waitFor();
      const month = todayInSaoPaulo().slice(0, 7);
      assert.ok(
        (
          await account
            .locator('[data-account-column="description"]')
            .innerText()
        ).startsWith(`${month.slice(5)}/${month.slice(0, 4)}`),
      );
      await account.locator(":scope > summary").click();
      assert.ok(
        (
          await account.locator("[data-account-description]").innerText()
        ).includes("Hospedagem gerenciada e manutenção"),
      );
      await account.getByText("Registrar recebimento", { exact: true }).click();
      await account
        .getByLabel("Valor recebido (R$)", { exact: true })
        .fill("40");
      await account
        .getByRole("button", { name: "Confirmar recebimento" })
        .click();
      await account
        .getByText("Recebimento registrado.", { exact: true })
        .waitFor();
      await page.reload();
      await account.locator(":scope > summary").click();
      await account
        .getByText("Histórico de recebimentos", { exact: false })
        .click();
      await account.getByRole("button", { name: /Estornar/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox").fill("Recebimento lançado por engano");
      await dialog.getByRole("button", { name: /Confirmar estorno/ }).click();
      await dialog.waitFor({ state: "hidden" });
      const contractId = contractUrl.split("/").at(-1)!;
      const payments = await db.receipt.findMany({
        where: { receivable: { contractId } },
        include: { reversal: true },
      });
      assert.equal(payments.length, 1);
      assert.ok(payments[0].reversal);
      await page
        .getByText("Editar condições comerciais", { exact: true })
        .click();
      const edit = page.getByRole("form", {
        name: "Editar condições do contrato",
      });
      await edit.getByLabel("Valor mensal (R$)", { exact: true }).fill("150");
      await edit.getByRole("button", { name: "Salvar condições" }).click();
      await page.getByText(/^R\$\s*150,00$/).waitFor();
      assert.equal(
        (
          await db.receivable.findFirstOrThrow({ where: { contractId } })
        ).amount.toFixed(2),
        "100.01",
      );
      await page
        .getByRole("button", { name: "Suspender", exact: true })
        .click();
      await dialog
        .getByLabel("Motivo", { exact: true })
        .fill("Pausa solicitada pelo cliente");
      await dialog
        .getByRole("button", { name: "Suspender contrato", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Reativar", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Reativar", exact: true }).click();
      await dialog
        .getByLabel("Motivo", { exact: true })
        .fill("Retomada do atendimento");
      await dialog
        .getByRole("button", { name: "Reativar contrato", exact: true })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Suspender", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Cancelar contrato", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Cancelar contrato", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        (
          await db.recurringContract.findUniqueOrThrow({
            where: { id: contractId },
          })
        ).status,
        "ATIVO",
      );
      await page.getByText(/^Histórico do contrato/).click();
      await page
        .getByText("Editar condições comerciais", { exact: true })
        .click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => {
          document.querySelectorAll("main").forEach((el) => {
            el.scrollTop = 0;
          });
          window.scrollTo(0, 0);
        });
        assert.equal(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("main")).some(
              (el) => el.scrollWidth > el.clientWidth + 1,
            ),
          ),
          false,
        );
        const inputBox = await generation
          .getByLabel("Competência", { exact: true })
          .boundingBox();
        const generateBox = await generation
          .getByRole("button", { name: "Gerar mensalidade", exact: true })
          .boundingBox();
        assert.ok(
          inputBox && generateBox && Math.abs(inputBox.y - generateBox.y) < 1,
          "month and generate action share the same row",
        );
        await page.screenshot({
          path: `/tmp/prospecta-contract-${width}.png`,
          fullPage: true,
        });
      }
      await page.goto(`${origin}/financeiro/contratos`);
      await page.getByLabel("Cliente", { exact: true }).fill("recorrente");
      await page.getByRole("button", { name: "Filtrar" }).click();
      await page
        .getByRole("link", { name: new RegExp(fixture.lead.name) })
        .waitFor();
      await page.getByLabel("Estado", { exact: true }).selectOption("SUSPENSO");
      await page.getByRole("button", { name: "Filtrar" }).click();
      await page
        .getByRole("heading", { name: "Nenhum contrato encontrado" })
        .waitFor();
      const service = new RecurringService(db);
      for (const [index, amount] of ["89.90", "1250.00"].entries()) {
        const id = randomUUID();
        await service.create(
          {
            id,
            saleId: fixture.sale.id,
            startsOn: todayInSaoPaulo(),
            terms: {
              kind: "MANUTENCAO",
              monthlyAmount: amount,
              description: "Manutenção do site e acompanhamento técnico",
              dueDay: 10,
              paymentMethod: "PIX",
              notes: "",
            },
          },
          fixture.users[0],
        );
        if (index === 0)
          await service.changeStatus(
            {
              id,
              expectedRevision: 0,
              status: "SUSPENSO",
              reason: "Pausa para revisão",
            },
            fixture.users[0],
          );
      }
      await page.goto(`${origin}/financeiro/contratos`);
      const contractLinks = page.locator("section ul > li > a");
      assert.equal(await contractLinks.count(), 3);
      await contractLinks.getByText("Suspenso", { exact: true }).waitFor();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => {
          document.querySelectorAll("main").forEach((el) => (el.scrollTop = 0));
        });
        const boxes = await contractLinks.evaluateAll((links) =>
          links.map((link) => ({
            height: link.getBoundingClientRect().height,
            monthly: link
              .querySelector('[data-contract-column="monthly"]')!
              .getBoundingClientRect().x,
            outstanding: link
              .querySelector('[data-contract-column="outstanding"]')!
              .getBoundingClientRect().x,
            monthlyY: link
              .querySelector('[data-contract-column="monthly"]')!
              .getBoundingClientRect().y,
            outstandingY: link
              .querySelector('[data-contract-column="outstanding"]')!
              .getBoundingClientRect().y,
          })),
        );
        await page.screenshot({
          path: `/tmp/prospecta-contract-list-${width}.png`,
        });
        for (const box of boxes)
          assert.ok(
            Math.abs(box.monthlyY - box.outstandingY) < 1,
            "monthly amount and balance align vertically",
          );
        if (width === 1440)
          for (const box of boxes) {
            assert.ok(Math.abs(box.monthly - boxes[0].monthly) < 1);
            assert.ok(Math.abs(box.outstanding - boxes[0].outstanding) < 1);
          }
        else
          assert.ok(
            boxes.every((box) => box.height < 175),
            `mobile rows remain compact: ${JSON.stringify(boxes)}`,
          );
        assert.equal(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("main")).some(
              (el) => el.scrollWidth > el.clientWidth + 1,
            ),
          ),
          false,
        );
        await page.screenshot({
          path: `/tmp/prospecta-contract-list-${width}.png`,
        });
      }
      const anonymous = await browser.newPage();
      await anonymous.goto(contractUrl);
      assert.equal(new URL(anonymous.url()).pathname, "/login");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await fixture.cleanup();
      await db.$disconnect();
    }
  },
);
