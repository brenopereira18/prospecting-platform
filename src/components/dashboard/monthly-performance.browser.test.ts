import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { getCommercialPeriods } from "../../server/leads/commercial-month";

test(
  "Chromium: automatic month navigation, history, compact indicators and mobile touch layout",
  {
    skip:
      process.env.MONTHLY_UI_BROWSER_TEST !== "1"
        ? "Set MONTHLY_UI_BROWSER_TEST=1 with PostgreSQL and a local Next server on port 3102."
        : false,
    timeout: 120_000,
  },
  async () => {
    const base = process.env.MONTHLY_UI_BASE_URL ?? "http://localhost:3102";
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const userId = randomUUID(),
      categoryId = randomUUID(),
      token = randomUUID();
    const period = getCommercialPeriods(undefined);
    const browser = await chromium.launch({ headless: true });
    try {
      await db.user.create({
        data: {
          id: userId,
          name: "Monthly UI test",
          email: `monthly-ui-${userId}@example.invalid`,
          passwordHash: "test-only",
        },
      });
      await db.category.create({
        data: { id: categoryId, name: `Monthly UI ${categoryId}` },
      });
      await db.session.create({
        data: {
          userId,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      await db.lead.createMany({
        data: [
          ...Array.from({ length: 7 }, (_, index) => ({
            createdAt: new Date(period.start.getTime() + index),
          })),
          { createdAt: new Date() },
          ...Array.from({ length: 2 }, (_, index) => ({
            createdAt: new Date(period.previousStart.getTime() + index),
          })),
        ].map((row) => ({
          ...row,
          userId,
          categoryId,
          source: "MANUAL" as const,
          name: "Disposable monthly UI lead",
        })),
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
      });
      await context.addCookies([
        {
          name: "session",
          value: token,
          url: base,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/dashboard`);
      const section = page.getByRole("region", {
        name: "Desempenho comercial",
        exact: true,
      });
      await section.waitFor();
      assert.equal(await section.locator("article").count(), 4);
      assert.equal(
        await section.getByRole("button", { name: "Aplicar" }).count(),
        0,
      );
      const card = section.getByRole("article", {
        name: "Leads cadastrados",
        exact: true,
      });
      assert.equal(await card.locator(":scope > p").first().innerText(), "8");
      const trend = card.locator(":scope > p").last();
      assert.equal(await section.locator("details, summary").count(), 0);
      assert.equal(
        await section.getByText("Entenda", { exact: true }).count(),
        0,
      );
      if (period.comparison.available)
        assert.match(await trend.innerText(), /\+5 leads \(\+250%\)/);
      await section.getByLabel("Mês de referência").focus();
      assert.equal(
        await section
          .getByLabel("Mês de referência")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await section.screenshot({
        path: "/tmp/prospecta-commercial-compact-desktop.png",
      });

      await section.getByLabel("Mês de referência").fill(period.previousMonth);
      await page.waitForURL(`**/dashboard?month=${period.previousMonth}`);
      await page.waitForFunction(
        (label) =>
          document
            .querySelector("#monthly-performance-title + p")
            ?.textContent?.startsWith(label),
        period.previousLabel.charAt(0).toLocaleUpperCase("pt-BR") +
          period.previousLabel.slice(1),
      );
      assert.equal(await card.locator(":scope > p").first().innerText(), "2");
      assert.match(await trend.innerText(), /\+2 leads/);
      assert.doesNotMatch(await trend.innerText(), /%/);
      assert.equal(await trend.locator(".lucide-arrow-up-right").count(), 0);
      await page.goBack();
      await page.waitForFunction(
        (month) =>
          (document.querySelector('input[type="month"]') as HTMLInputElement)
            ?.value === month,
        period.month,
      );
      await page.goForward();
      await page.waitForFunction(
        (month) =>
          (document.querySelector('input[type="month"]') as HTMLInputElement)
            ?.value === month,
        period.previousMonth,
      );
      const before = page.url();
      await section.getByLabel("Mês de referência").fill("9999-12");
      await section.getByLabel("Mês de referência").blur();
      assert.equal(page.url(), before);
      assert.equal(
        await section.getByLabel("Mês de referência").inputValue(),
        period.previousMonth,
      );

      await page.setViewportSize({ width: 390, height: 844 });
      await section.evaluate((el) => el.scrollIntoView({ block: "start" }));
      const width = await section.evaluate((el) => ({
        box: el.getBoundingClientRect().width,
        scroll: el.scrollWidth,
      }));
      assert.ok(width.scroll <= width.box + 1);
      await page.screenshot({
        path: "/tmp/prospecta-commercial-compact-mobile.png",
      });
      assert.equal(await section.locator("details, summary").count(), 0);
      const touchContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      await touchContext.addCookies(await context.cookies());
      const touchPage = await touchContext.newPage();
      await touchPage.goto(`${base}/dashboard?month=${period.previousMonth}`);
      const touchInput = touchPage.getByLabel("Mês de referência");
      await touchInput.tap();
      assert.equal(
        await touchInput.evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(
        await touchPage
          .getByRole("region", { name: "Desempenho comercial", exact: true })
          .locator("article")
          .count(),
        4,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      try {
        await db.user.deleteMany({ where: { id: userId } });
        await db.category.deleteMany({ where: { id: categoryId } });
      } finally {
        await db.$disconnect();
      }
    }
  },
);
