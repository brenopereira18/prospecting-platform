import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import catalog from "./catalog.json";

const testUrl = process.env.LOCATION_TEST_URL;

test(
  "seleção real das 27 UFs e municípios funciona sem requests ao IBGE",
  {
    skip:
      !testUrl &&
      "Defina LOCATION_TEST_URL para um servidor local em execução.",
  },
  async () => {
    assert.ok(testUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(new URL(testUrl).hostname));
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      let ibgeRequests = 0;
      await page.route("**://servicodados.ibge.gov.br/**", (route) => {
        ibgeRequests++;
        return route.abort();
      });
      const response = await page.goto(`${testUrl}/descobrir-negocios`);
      assert.equal(response?.status(), 200);
      const stateBox = page.getByText("Estado", { exact: true }).locator("..");
      const cityButton = page.getByRole("button", {
        name: "Cidade",
        exact: true,
      });
      const cityMenu = cityButton.locator("..").locator("div.absolute");
      async function selectState(state: (typeof catalog.states)[number]) {
        await stateBox.getByRole("button").first().click();
        await stateBox
          .getByRole("button", { name: state.name, exact: true })
          .click();
        await page.waitForFunction(
          () =>
            !(
              document.querySelector(
                'button[aria-label="Cidade"]',
              ) as HTMLButtonElement
            ).disabled,
        );
        assert.ok((await cityButton.innerText()).includes("Selecione"));
        await cityButton.click();
        const expected = catalog.cities.filter(
          (city) => city.stateId === state.id,
        );
        await page.waitForFunction(
          (count) =>
            document
              .querySelector('button[aria-label="Cidade"]')
              ?.parentElement?.querySelectorAll("div.absolute button")
              .length === count,
          expected.length,
        );
        assert.deepEqual(
          await cityMenu.getByRole("button").allTextContents(),
          expected.map((city) => city.name),
        );
        await cityMenu
          .getByRole("button", { name: expected[0].name, exact: true })
          .click();
        assert.ok((await cityButton.innerText()).includes(expected[0].name));
      }
      for (const state of catalog.states) await selectState(state);
      await page.setViewportSize({ width: 390, height: 844 });
      for (const id of [31, 33, 53]) {
        const state = catalog.states.find((item) => item.id === id);
        assert.ok(state);
        await selectState(state);
      }
      assert.equal(ibgeRequests, 0);
    } finally {
      await browser.close();
    }
  },
);
