import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { getCommercialPeriods } from "../leads/commercial-month";

test(
  "Chromium: goals are validated, saved, edited and restored per month with responsive keyboard controls",
  { skip: process.env.FINANCE_BROWSER_TEST !== "1", timeout: 120000 },
  async () => {
    const origin = process.env.FINANCE_UI_BASE_URL ?? "http://localhost:3102";
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const userId = randomUUID(),
      token = randomUUID();
    const browser = await chromium.launch({ headless: true });
    try {
      await db.user.create({
        data: {
          id: userId,
          name: "Metas teste",
          email: `goal-ui-${userId}@example.invalid`,
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
      await page.goto(`${origin}/dashboard`);
      const card = page.getByRole("region", { name: "Vendas fechadas no mês" });
      const edit = card.getByRole("button", {
        name: /Definir meta|Editar meta/,
      });
      await edit.waitFor();
      assert.equal(await edit.innerText(), "Definir meta");
      await edit.focus();
      await page.keyboard.press("Enter");
      const amount = card.getByRole("textbox", { name: /Meta de/ });
      await amount.waitFor();
      assert.equal(
        await amount.evaluate((el) => el === document.activeElement),
        true,
      );
      await amount.fill("0");
      await card.getByRole("button", { name: "Salvar meta" }).click();
      await card.getByText("Informe um valor maior que zero.").waitFor();
      assert.equal(await amount.inputValue(), "0");
      await amount.fill("5000,01");
      await card.getByRole("button", { name: "Salvar meta" }).click();
      await card.getByText("Meta salva.", { exact: true }).waitFor();
      await card.getByRole("button", { name: "Editar meta" }).waitFor();
      assert.equal(
        await card.getByRole("progressbar").getAttribute("aria-valuenow"),
        "0",
      );
      await page.reload();
      await card.getByRole("button", { name: "Editar meta" }).click();
      assert.equal(await amount.inputValue(), "5000,01");
      await amount.fill("9000");
      await page.keyboard.press("Escape");
      assert.equal(await card.getByRole("textbox").count(), 0);
      await edit.click();
      assert.equal(await amount.inputValue(), "5000,01");
      await amount.fill("7000");
      await card.getByRole("button", { name: "Salvar meta" }).click();
      await card.getByText("Meta salva.", { exact: true }).waitFor();
      const period = getCommercialPeriods(undefined);
      await page.getByLabel("Mês de referência").fill(period.previousMonth);
      await page.waitForURL(`**/dashboard?month=${period.previousMonth}`);
      await card.getByRole("button", { name: "Definir meta" }).click();
      await amount.fill("3000");
      await card.getByRole("button", { name: "Salvar meta" }).click();
      await card.getByText("Meta salva.", { exact: true }).waitFor();
      await page.goBack();
      await page.waitForURL(`${origin}/dashboard`);
      await card
        .getByText(`${period.label} · Em andamento`, { exact: true })
        .waitFor();
      if ((await edit.getAttribute("aria-expanded")) !== "true")
        await edit.click();
      assert.equal(await amount.inputValue(), "7000,00");
      await page.keyboard.press("Escape");
      const goals = await db.monthlySalesGoal.findMany({
        where: { userId },
        orderBy: { month: "asc" },
      });
      assert.deepEqual(
        goals.map((g) => g.amount.toFixed(2)),
        ["3000.00", "7000.00"],
      );
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        const clients = await card.locator("dd").nth(0).boundingBox();
        const ticket = await card.locator("dd").nth(1).boundingBox();
        assert.ok(clients && ticket && Math.abs(clients.y - ticket.y) < 1);
        assert.equal(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("main")).some(
              (el) => el.scrollWidth > el.clientWidth + 1,
            ),
          ),
          false,
        );
        await card.screenshot({
          path: `/tmp/prospecta-monthly-goal-${width}.png`,
        });
        await edit.click();
        assert.equal(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("main")).some(
              (el) => el.scrollWidth > el.clientWidth + 1,
            ),
          ),
          false,
        );
        if (width === 390)
          await card.screenshot({
            path: "/tmp/prospecta-monthly-goal-form-mobile.png",
          });
        await card.getByRole("button", { name: "Cancelar" }).click();
      }
      assert.deepEqual(errors, []);
      const anonymous = await browser.newPage();
      await anonymous.goto(`${origin}/dashboard`);
      assert.equal(new URL(anonymous.url()).pathname, "/login");
    } finally {
      await browser.close();
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
