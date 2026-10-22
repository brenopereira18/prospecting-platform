import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { MonthlyPerformance } from "./monthly-performance";
import {
  buildMonthlyMetric,
  getCommercialPeriods,
  type LeadMonthlyPerformanceDTO,
} from "../../server/leads/commercial-month";

const router = {
  push() {},
  replace() {},
  back() {},
  forward() {},
  refresh() {},
  prefetch() {},
} as unknown as AppRouterInstance;
function renderToStaticMarkup(node: React.ReactNode) {
  return renderMarkup(
    <AppRouterContext.Provider value={router}>
      {node}
    </AppRouterContext.Provider>,
  );
}
function article(html: string, label: string) {
  return html.match(
    new RegExp(
      `<article[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</article>`,
    ),
  )![1];
}
function fixture(): LeadMonthlyPerformanceDTO {
  return {
    month: "2026-10",
    currentMonth: "2026-11",
    previousMonth: "2026-09",
    label: "outubro de 2026",
    previousLabel: "setembro de 2026",
    partial: false,
    asOf: "2026-11-15T15:00:00Z",
    selectionWarning: null,
    comparisonPeriod: {
      available: true,
      completeDays: null,
      label: "Comparação com setembro de 2026, ambos os meses completos.",
    },
    coverage: {
      since: "2026-08-01T03:00:00Z",
      selected: "complete",
      comparisonSelected: "complete",
      previous: "complete",
    },
    metrics: {
      registered: buildMonthlyMetric(5, 5, 2),
      proposals: buildMonthlyMetric(0, 0, 0),
      won: buildMonthlyMetric(2, 2, 0),
      lost: buildMonthlyMetric(1, 1, 2),
    },
  };
}

test("only header, month selector and four simple indicators remain", () => {
  const html = renderToStaticMarkup(<MonthlyPerformance data={fixture()} />);
  assert.match(html, /Desempenho comercial<\/h2>/);
  assert.match(html, /Outubro de 2026 · Encerrado/);
  assert.match(html, /type="month"/);
  assert.match(html, /max="2026-11"/);
  assert.match(html, /value="2026-10"/);
  assert.doesNotMatch(
    html,
    /<details|<summary|Entenda|Aplicar|Período comparável|Mesmo período|America\/Sao_Paulo/,
  );
  for (const [label, value] of [
    ["Leads cadastrados", 5],
    ["Propostas enviadas", 0],
    ["Ganhos", 2],
    ["Perdidos", 1],
  ] as const)
    assert.match(article(html, label), new RegExp(`<p[^>]*>${value}</p>`));
  assert.doesNotMatch(html, /Histórico parcial|NaN|Infinity/);
});

test("ongoing month keeps the main total and the server-provided short trend", () => {
  const data = { ...fixture(), partial: true };
  data.comparisonPeriod = getCommercialPeriods(
    "2026-10",
    new Date("2026-10-22T15:30:00Z"),
  ).comparison;
  data.metrics.registered = buildMonthlyMetric(9, 3, 2);
  const html = renderToStaticMarkup(<MonthlyPerformance data={data} />);
  assert.match(html, /Em andamento/);
  assert.match(article(html, "Leads cadastrados"), /<p[^>]*>9<\/p>/);
  assert.ok(html.includes("+1 lead (+50%)"));
  assert.doesNotMatch(html, /350%|Período comparável|intervalos|1 a 21/);
});

test("partial history gets a single short notice and no per-card explanation", () => {
  const data = fixture();
  data.coverage.selected = "partial";
  data.coverage.comparisonSelected = "partial";
  data.coverage.previous = "partial";
  data.metrics.won = buildMonthlyMetric(2, 2, null, false);
  data.selectionWarning = "Mês inválido ou futuro. Exibindo o mês atual.";
  const html = renderToStaticMarkup(<MonthlyPerformance data={data} />);
  assert.equal((html.match(/Histórico parcial:/g) ?? []).length, 1);
  assert.doesNotMatch(article(html, "Ganhos"), /histórico parcial|cobertura/);
  assert.match(article(html, "Ganhos"), /aria-label="Comparação indisponível"/);
  assert.match(html, /role="status"[^>]*>Mês inválido/);
});

test("unavailable comparisons and unknown totals use dashes instead of invented zeroes", () => {
  const data = fixture();
  data.coverage = {
    since: null,
    selected: "unknown",
    comparisonSelected: "unknown",
    previous: "unknown",
  };
  data.metrics.won = buildMonthlyMetric(null, null, null, false);
  const card = article(
    renderToStaticMarkup(<MonthlyPerformance data={data} />),
    "Ganhos",
  );
  assert.match(card, /Total indisponível/);
  assert.match(card, /aria-label="Comparação indisponível"/);
  assert.match(card, />—<\/p>/);
  assert.doesNotMatch(
    card,
    /Sem comparação|text-primary|text-red-300|>0<|Histórico indisponível/,
  );
});

test("zero base remains a neutral absolute trend; stability remains explicit", () => {
  const html = renderToStaticMarkup(<MonthlyPerformance data={fixture()} />);
  const card = article(html, "Ganhos");
  assert.ok(card.includes("+2 leads"));
  assert.doesNotMatch(card, /%|arrow-up-right|text-primary|text-red-300/);
  assert.match(article(html, "Propostas enviadas"), /Sem variação/);
});

test("losses preserve their inverse improvement color and accessible label", () => {
  const data = fixture();
  let card = article(
    renderToStaticMarkup(<MonthlyPerformance data={data} />),
    "Perdidos",
  );
  assert.match(card, /text-primary/);
  assert.match(card, /Melhora no período/);
  data.metrics.lost = buildMonthlyMetric(3, 3, 2);
  card = article(
    renderToStaticMarkup(<MonthlyPerformance data={data} />),
    "Perdidos",
  );
  assert.match(card, /text-red-300/);
  assert.match(card, /Piora no período/);
});

test("the first day shows only a dash in every comparison row", () => {
  const data = { ...fixture(), partial: true };
  data.comparisonPeriod.available = false;
  const html = renderToStaticMarkup(<MonthlyPerformance data={data} />);
  assert.equal(
    (html.match(/aria-label="Comparação indisponível"/g) ?? []).length,
    4,
  );
  assert.doesNotMatch(html, /150%|Sem variação|dias completos|Sem comparação/);
});
