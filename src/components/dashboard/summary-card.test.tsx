import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SummaryCard } from "./summary-card";
import type { MonthlySalesDTO } from "../../server/finance/monthly-sales.schema";

const base: MonthlySalesDTO = {
  month: "2026-10",
  label: "outubro de 2026",
  partial: true,
  sold: "250.00",
  saleCount: 2,
  clients: 1,
  averageTicket: "125.00",
  goal: null,
  percentage: null,
  remaining: null,
  exceeded: null,
};
function render(data = base) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={{} as AppRouterInstance}>
      <SummaryCard data={data} />
    </AppRouterContext.Provider>,
  );
}
test("unconfigured goal has a clear action, real sales and no invented target or trend", () => {
  const html = render();
  assert.match(html, /Vendas fechadas no mês/);
  assert.match(html, /Definir meta/);
  assert.match(html, /Defina uma meta mensal/);
  assert.match(html, /Clientes conquistados/);
  assert.match(html, /Ticket médio/);
  assert.match(html, /250,00/);
  assert.match(html, /125,00/);
  assert.doesNotMatch(html, /Meta: 4|2\.100|-50%|role="progressbar"/);
});
test("configured goal shows the exact goal, percentage and remaining money", () => {
  const html = render({
    ...base,
    goal: "1000.00",
    percentage: 25,
    remaining: "750.00",
    exceeded: "0.00",
  });
  assert.match(html, /Editar meta/);
  assert.match(html, /1\.000,00/);
  assert.match(html, /25% atingido/);
  assert.match(html, /Faltam R\$ 750,00/);
  assert.match(html, /aria-valuenow="25"/);
});
test("exceeded goals retain the full accessible percentage without overflowing or negative remaining money", () => {
  const html = render({
    ...base,
    goal: "100.00",
    percentage: 250,
    remaining: "0.00",
    exceeded: "150.00",
  });
  assert.match(html, /250% atingido/);
  assert.match(html, /aria-valuemax="250" aria-valuenow="250"/);
  assert.match(html, /width:100%/);
  assert.match(html, /Meta superada em R\$ 150,00/);
  assert.doesNotMatch(html, /Faltam|NaN|Infinity/);
});
