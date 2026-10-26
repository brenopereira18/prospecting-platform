import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LeadStatusControl } from "./lead-status-control";
import { LeadStatusHistory } from "./lead-status-history";

test("the status control exposes the current status and hides save until a different value is selected", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider
      value={{
        push: noop,
        replace: noop,
        refresh: noop,
        back: noop,
        forward: noop,
        prefetch: noop,
        bfcacheId: "lead-status-test",
      }}
    >
      <LeadStatusControl
        leadId="12345678-1234-4234-8234-123456789012"
        status="GANHO"
        statusRevision={4}
      />
    </AppRouterContext.Provider>,
  );
  assert.equal((html.match(/<option /g) ?? []).length, 4);
  assert.match(html, /<option value="GANHO" selected="">Ganho<\/option>/);
  assert.match(html, /<label for="[^"]+"[^>]*>Status comercial<\/label>/);
  assert.doesNotMatch(html, /<button type="submit"/);
  assert.doesNotMatch(html, /Salvar alteração/);
  assert.ok(html.includes('aria-label="Alterar status comercial"'));
});

test("legacy leads explain the absent historical date without inventing an event", () => {
  const html = renderToStaticMarkup(<LeadStatusHistory entries={[]} />);
  assert.ok(html.includes("Nenhuma mudança de status registrada."));
  assert.ok(html.includes("a data de entrada nessa etapa não está registrada"));
  assert.doesNotMatch(html, /<time|<li/);
});

test("history shows actual transitions and formats their effective timestamps in Sao Paulo", () => {
  const html = renderToStaticMarkup(
    <LeadStatusHistory
      entries={[
        {
          id: "entry",
          fromStatus: "NOVO",
          toStatus: "PROPOSTA_ENVIADA",
          revision: 1,
          occurredAt: "2026-10-22T01:30:00.000Z",
          recordedAt: "2026-10-22T01:30:01.000Z",
        },
      ]}
    />,
  );
  assert.ok(html.includes("Novo"));
  assert.ok(html.includes("Proposta enviada"));
  assert.ok(html.includes("21/10/2026 às 22:30"));
  assert.match(html, /<time\b[^>]*datetime="2026-10-22T01:30:00.000Z"/i);
  assert.ok(html.includes("mais recentes primeiro"));
  assert.match(html, /aria-label="Histórico comercial \(1\)"/);
  assert.doesNotMatch(html, /<details[^>]*\bopen[= >]/);
});
