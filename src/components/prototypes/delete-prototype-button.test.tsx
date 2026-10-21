import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { DeletePrototypeButton } from "./delete-prototype-button";

test("delete control starts with a closed, labelled confirmation and explains irreversible version deletion", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(<AppRouterContext.Provider value={{ push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop, bfcacheId: "delete-test" }}><DeletePrototypeButton id="12345678-1234-4234-8234-123456789012" name="Proposta Bairro" revision={3} /></AppRouterContext.Provider>);
  assert.ok(html.includes('aria-label="Excluir protótipo Proposta Bairro"'));
  assert.ok(html.includes("todas as suas versões serão excluídos permanentemente"));
  assert.ok(html.includes("O lead será mantido"));
  assert.ok(html.includes("Cancelar"));
  assert.ok(html.includes("Excluir definitivamente"));
  const dialog = html.match(/<dialog\b[^>]*>/)?.[0] ?? "";
  assert.ok(dialog.includes("aria-labelledby="));
  assert.ok(dialog.includes("aria-describedby="));
  assert.ok(!/\bopen(?:=|\s|>)/.test(dialog));
});
