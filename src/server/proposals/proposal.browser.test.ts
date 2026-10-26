import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFile, writeFile } from "node:fs/promises";

test(
  "Chromium: proposal form, review, confirmation, private PDF, duplication and mobile",
  { skip: process.env.PROPOSAL_BROWSER_TEST !== "1", timeout: 120000 },
  async () => {
    const origin = process.env.PROPOSAL_UI_BASE_URL || "http://localhost:3102";
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const userId = randomUUID(),
      otherUserId = randomUUID(),
      categoryId = randomUUID();
    const token = randomUUID();
    const browser = await chromium.launch({ headless: true });
    try {
      await db.user.createMany({
        data: [userId, otherUserId].map((id) => ({
          id,
          name: "Breno",
          email: `proposal-ui-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.session.create({
        data: {
          userId,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await db.category.create({
        data: { id: categoryId, name: `Hamburgueria ${categoryId}` },
      });
      const lead = await db.lead.create({
        data: {
          userId,
          categoryId,
          source: "MANUAL",
          name: "Hamburgueria Central",
          address: "Rua das Palmeiras, 120",
          phone: "(32) 99999-0000",
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
      await page.goto(`${origin}/leads/${lead.id}?tab=proposals`);
      await page.getByRole("link", { name: "Nova proposta" }).click();
      await page
        .getByLabel("Título da proposta", { exact: true })
        .fill("Landing page para Hamburgueria Central");
      await page
        .getByLabel("Descrição do serviço", { exact: true })
        .fill(
          "Criação de um site responsivo para apresentar o estabelecimento e facilitar pedidos.",
        );
      await page
        .getByLabel("Escopo e entregáveis", { exact: true })
        .fill(
          "Página inicial e apresentação.\nCardápio, avaliações e localização.\nConfiguração de domínio e publicação.",
        );
      await page
        .getByLabel("Valor do desenvolvimento (R$)", { exact: true })
        .fill("2990,90");
      await page
        .getByLabel("Condições de pagamento", { exact: true })
        .selectOption("A_NEGOCIAR");
      assert.equal(
        await page.getByLabel("Definir uma entrada", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByLabel("Pagamento integral", { exact: true }).count(),
        0,
      );
      await page
        .getByLabel("Condições de pagamento", { exact: true })
        .selectOption("DEFINIDAS");
      await page.getByLabel("Definir uma entrada", { exact: true }).check();
      await page
        .getByLabel("Valor da entrada (R$)", { exact: true })
        .fill("990,10");
      await page
        .getByLabel("Pagamento do saldo", { exact: true })
        .selectOption("CARTAO");
      await page
        .getByLabel("Quantidade de parcelas", { exact: true })
        .fill("3");
      await page
        .getByLabel("Prazo de entrega (dias corridos)", { exact: true })
        .fill("20");
      await page.getByLabel("Válida até", { exact: true }).fill("2026-11-15");
      await page
        .getByLabel("Oferecer hospedagem gerenciada (opcional)", {
          exact: true,
        })
        .check();
      await page.getByLabel("Mensalidade (R$)", { exact: true }).fill("99,90");
      await page
        .getByLabel("O que está incluído na manutenção (opcional)", {
          exact: true,
        })
        .fill("Hospedagem, backups e atualização de textos.");
      await page
        .getByLabel("Informações adicionais (opcional)", { exact: true })
        .fill("Materiais e fotografias fornecidos pelo cliente.");
      await page.locator("main").evaluate((element) => (element.scrollTop = 0));
      await page.screenshot({
        path: "/tmp/prospecta-proposal-form-desktop.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Salvar rascunho", exact: true })
        .click();
      await page.waitForURL(/\/propostas\/[a-f0-9-]{36}$/);
      const id = page.url().split("/").at(-1)!;
      assert.equal(
        await page
          .getByRole("heading", {
            name: "Landing page para Hamburgueria Central",
            exact: true,
          })
          .count(),
        1,
      );
      assert.match(await page.locator("article").innerText(), /2\.000,80/);
      await page.getByRole("link", { name: "Editar", exact: true }).click();
      await page
        .getByLabel("Título da proposta", { exact: true })
        .fill("Site para Hamburgueria Central");
      await page
        .getByRole("button", { name: "Salvar rascunho", exact: true })
        .click();
      await page.waitForURL(/\/propostas\/[a-f0-9-]{36}$/);
      await page
        .getByRole("combobox", { name: "Status da proposta", exact: true })
        .selectOption("ENVIADA");
      await page
        .getByRole("button", { name: "Atualizar status", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      assert.equal(
        await page
          .getByRole("button", { name: "Cancelar", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        (await db.commercialProposal.findUniqueOrThrow({ where: { id } }))
          .status,
        "RASCUNHO",
      );
      await page
        .getByRole("button", { name: "Atualizar status", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirmar status", exact: true })
        .click();
      await page.getByText("Conteúdo preservado.", { exact: false }).waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Editar", exact: true }).count(),
        0,
      );
      const downloaded = page.waitForEvent("download");
      const pdfResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/propostas/${id}/pdf`),
      );
      await page
        .getByRole("button", { name: "Baixar PDF", exact: true })
        .click();
      await (await downloaded).saveAs("/tmp/prospecta-proposal.pdf");
      assert.equal(
        (await pdfResponse).headers()["cache-control"],
        "private, no-store",
      );
      assert.equal(
        (await readFile("/tmp/prospecta-proposal.pdf"))
          .subarray(0, 4)
          .toString(),
        "%PDF",
      );
      await page.screenshot({
        path: "/tmp/prospecta-proposal-desktop.png",
        fullPage: true,
      });
      const anonymous = await browser.newContext();
      assert.equal(
        (
          await anonymous.request.get(`${origin}/api/propostas/${id}/pdf`)
        ).status(),
        401,
      );
      const otherToken = randomUUID();
      await db.session.create({
        data: {
          userId: otherUserId,
          tokenHash: createHash("sha256").update(otherToken).digest("hex"),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await anonymous.addCookies([
        { name: "session", value: otherToken, url: origin },
      ]);
      assert.equal(
        (
          await anonymous.request.get(`${origin}/api/propostas/${id}/pdf`)
        ).status(),
        404,
      );
      const forbidden = await anonymous.newPage();
      assert.equal(
        (
          await forbidden.goto(`${origin}/leads/${lead.id}/propostas/${id}`)
        )?.status(),
        404,
      );
      await anonymous.close();
      await page
        .getByRole("button", { name: "Duplicar como rascunho", exact: true })
        .click();
      await page.waitForURL(/edit=1$/);
      assert.notEqual(new URL(page.url()).pathname.split("/").at(-1), id);
      const copyId = new URL(page.url()).pathname.split("/").at(-1)!;
      await page
        .getByLabel("Condições de pagamento", { exact: true })
        .selectOption("A_NEGOCIAR");
      assert.equal(
        await page.getByLabel("Valor da entrada (R$)", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByLabel("Quantidade de parcelas", { exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Salvar rascunho", exact: true })
        .click();
      await page.waitForURL(/\/propostas\/[a-f0-9-]{36}$/);
      const copy = await db.commercialProposal.findUniqueOrThrow({
        where: { id: copyId },
      });
      assert.equal(copy.paymentMode, "A_NEGOCIAR");
      assert.equal(copy.deposit, null);
      assert.equal(copy.depositMethod, null);
      assert.equal(copy.balanceInstallments, null);
      assert.equal(copy.sourceProposalId, id);
      assert.equal(copy.status, "RASCUNHO");
      assert.match(
        await page.locator("article").innerText(),
        /Entrada e parcelamento a combinar/,
      );
      assert.doesNotMatch(
        await page.locator("article").innerText(),
        /Entrada:|Saldo:/,
      );
      const original = await db.commercialProposal.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(original.paymentMode, "DEFINIDAS");
      assert.equal(original.deposit?.toFixed(2), "990.10");
      assert.equal(
        await db.proposalStatusHistory.count({ where: { proposalId: id } }),
        1,
      );
      const negotiationPdf = await context.request.get(
        `${origin}/api/propostas/${copyId}/pdf`,
      );
      assert.equal(negotiationPdf.status(), 200);
      const negotiationBytes = await negotiationPdf.body();
      assert.equal(negotiationBytes.subarray(0, 4).toString(), "%PDF");
      await writeFile(
        "/tmp/prospecta-proposal-negotiable.pdf",
        negotiationBytes,
      );
      await page.getByRole("link", { name: "Editar", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel("Título da proposta", { exact: true }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      const formBox = await page.locator("form").boundingBox();
      assert.ok(
        formBox && formBox.width >= 280 && formBox.x + formBox.width <= 390,
      );
      assert.ok(
        await page
          .locator("form")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      );
      await page.screenshot({
        path: "/tmp/prospecta-proposal-form-mobile.png",
        fullPage: true,
      });
      await page.goto(`${origin}/leads/${lead.id}?tab=proposals`);
      await page
        .getByRole("heading", { name: "Propostas comerciais", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Baixar PDF", exact: true })
          .count(),
        2,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.locator("#propostas").scrollIntoViewIfNeeded();
      const listBox = await page.locator("#propostas").boundingBox();
      assert.ok(
        listBox && listBox.width >= 280 && listBox.x + listBox.width <= 390,
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Editar proposta", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page.getByRole("button", { name: /Excluir proposta/ }).count(),
        0,
      );
      const card = page.locator("#propostas article").first();
      await card.locator("summary").focus();
      await page.keyboard.press("Enter");
      await card.getByRole("button", { name: /Excluir proposta/ }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await card
          .getByRole("button", { name: /Excluir proposta/ })
          .isVisible(),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator("#propostas").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "/tmp/prospecta-proposal-list-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#propostas").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "/tmp/prospecta-proposal-list-mobile.png",
        fullPage: true,
      });
      await card.locator("summary").click();
      await card.getByRole("button", { name: /Excluir proposta/ }).click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await db.commercialProposal.count({
          where: { userId, deletedAt: { not: null } },
        }),
        0,
      );
      assert.ok(
        await card
          .locator("summary")
          .evaluate((element) => element === document.activeElement),
      );
      await card.locator("summary").click();
      await card.getByRole("button", { name: /Excluir proposta/ }).click();

      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Excluir proposta", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll("#propostas article").length === 1,
      );
      assert.equal(await db.commercialProposal.count({ where: { userId } }), 2);
      assert.equal(
        await db.commercialProposal.count({
          where: { userId, deletedAt: { not: null } },
        }),
        1,
      );
      assert.equal(
        (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status,
        "NOVO",
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await db.proposalStatusHistory.deleteMany({
        where: { proposal: { userId } },
      });
      await db.commercialProposal.deleteMany({
        where: { userId, sourceProposalId: { not: null } },
      });
      await db.commercialProposal.deleteMany({ where: { userId } });
      await db.user.deleteMany({
        where: { id: { in: [userId, otherUserId] } },
      });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
