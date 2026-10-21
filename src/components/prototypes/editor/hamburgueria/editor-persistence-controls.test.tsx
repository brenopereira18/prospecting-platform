import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorPersistenceControls } from "./editor-persistence-controls";
import type { usePrototypePersistence } from "./use-prototype-persistence";

function state(overrides: Partial<ReturnType<typeof usePrototypePersistence>> = {}): ReturnType<typeof usePrototypePersistence> {
  return { name: "Proposta do cliente", setName: () => {}, revision: 4, status: { kind: "idle", message: "" }, busy: false, dirty: false, hasTemporaryImages: false, uploads: {}, save: async () => {}, createVersion: async () => {}, ...overrides };
}
const render = (persistence: ReturnType<typeof usePrototypePersistence>) => renderToStaticMarkup(<EditorPersistenceControls id="private-id" persistence={persistence} />);

test("persistence controls expose internal name, revision, save and private version links", () => {
  const html = render(state({ dirty: true }));
  for (const text of ["Proposta do cliente", "Revisão 4", "Salvar rascunho", "Criar versão", 'href="/prototipos/private-id/versoes"']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /disabled=""[^>]*>Criar versão/);
});
test("saving, success and errors are visible and temporary images can be persisted explicitly", () => {
  for (const kind of ["saving", "saved", "error"] as const) assert.ok(render(state({ status: { kind, message: `Estado ${kind}` }, busy: kind === "saving" })).includes(`Estado ${kind}`));
  const html = render(state({ dirty: true, hasTemporaryImages: true }));
  assert.ok(html.includes("As imagens usadas serão enviadas ao salvar"));
  assert.doesNotMatch(html, /disabled=""[^>]*>Salvar rascunho/);
  assert.match(render(state({ dirty: true, busy: true })), /disabled=""[^>]*>Salvar rascunho/);
});
test("conflict keeps local edits and offers comparison in another tab instead of automatic restoration", () => {
  const html = render(state({ dirty: true, status: { kind: "conflict", message: "Suas alterações locais foram mantidas." } }));
  assert.ok(html.includes("Suas alterações locais foram mantidas."));
  const comparison = html.match(/<a\b([^>]*)>Abrir rascunho salvo em outra aba<\/a>/)?.[1];
  assert.ok(comparison);
  assert.ok(comparison.includes('href="/prototipos/private-id"'));
  assert.ok(comparison.includes('target="_blank"'));
  assert.ok(!html.includes("Descartar alterações"));
});
