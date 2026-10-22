import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FunnelCard } from "./funnel-card";
import type { LeadCommercialFunnelDTO } from "../../server/leads/lead.dto";

const empty: LeadCommercialFunnelDTO = {
  total: 0,
  counts: { NOVO: 0, PROPOSTA_ENVIADA: 0, GANHO: 0, PERDIDO: 0 },
  conversionRate: 0,
};

test("empty funnel shows zero conversion and zero bars without discovered-lead placeholders", () => {
  const html = renderToStaticMarkup(<FunnelCard data={empty} />);
  assert.ok(html.includes("Nenhum lead cadastrado ainda."));
  assert.ok(html.includes("0%"));
  assert.equal((html.match(/width:0%/g) ?? []).length, 4);
  assert.doesNotMatch(
    html,
    /Leads encontrados|NaN|Infinity|w-1\/2|w-\[8.33%\]|text-icon-success/,
  );
});

test("current status bars use the registered total and terminal outcomes are grouped separately", () => {
  const html = renderToStaticMarkup(
    <FunnelCard
      data={{
        total: 10,
        counts: { NOVO: 4, PROPOSTA_ENVIADA: 3, GANHO: 2, PERDIDO: 1 },
        conversionRate: 20,
      }}
    />,
  );
  for (const [label, value] of [
    ["Ainda não abordados", 40],
    ["Propostas enviadas", 30],
    ["Ganhos", 20],
    ["Perdidos", 10],
  ] as const)
    assert.ok(
      html.includes(
        `aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"`,
      ),
    );
  assert.ok(html.includes('aria-label="Em andamento"'));
  assert.ok(html.includes('aria-label="Resultados"'));
  assert.ok(html.includes("20%"));
  assert.ok(html.includes("Leads ganhos ÷ total de leads cadastrados."));
});

test("conversion is formatted in Portuguese and bar widths are limited to zero through one hundred", () => {
  const html = renderToStaticMarkup(
    <FunnelCard
      data={{
        total: 3,
        counts: { NOVO: 2, PROPOSTA_ENVIADA: 0, GANHO: 1, PERDIDO: 0 },
        conversionRate: 100 / 3,
      }}
    />,
  );
  assert.ok(html.includes("33,3%"));
  const limits = renderToStaticMarkup(
    <FunnelCard
      data={{
        ...empty,
        total: 1,
        counts: { ...empty.counts, NOVO: 2, PERDIDO: -1 },
      }}
    />,
  );
  const widths = [...limits.matchAll(/style="width:([\d.]+)%"/g)].map((match) =>
    Number(match[1]),
  );
  assert.equal(widths.length, 4);
  assert.ok(widths.every((width) => width >= 0 && width <= 100));
});
