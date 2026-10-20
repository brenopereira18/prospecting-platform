import assert from "node:assert/strict";
import { test } from "node:test";
import { createEditorDocument, editorDocumentReducer } from "./editor-document";
import { serializeEditorDraft, hasUnsavedPrototypeChanges, hasImagesBlockingSave, editorPersistenceErrors } from "./editor-save-state";

test("dirty state compares against the saved prototype rather than the Brasa default", () => {
  const document = createEditorDocument(); document.business.name = "Cliente real";
  const baseline = serializeEditorDraft(document, "Proposta A");
  assert.equal(hasUnsavedPrototypeChanges(document, "Proposta A", baseline), false);
  assert.equal(hasUnsavedPrototypeChanges(document, "Proposta B", baseline), true);
  const changed = editorDocumentReducer(document, { type: "heroHeadline", index: 0, value: "Nova chamada" });
  assert.equal(hasUnsavedPrototypeChanges(changed, "Proposta A", baseline), true);
});
test("edits typed during saving remain dirty when the submitted snapshot succeeds", () => {
  const submitted = createEditorDocument(); const snapshot = serializeEditorDraft(submitted, "Proposta");
  const current = editorDocumentReducer(submitted, { type: "business", field: "name", value: "Digitado durante a requisição" });
  assert.equal(hasUnsavedPrototypeChanges(current, "Proposta", snapshot), true);
  assert.equal(current.business.name, "Digitado durante a requisição");
  assert.equal(hasUnsavedPrototypeChanges(submitted, "Proposta", snapshot), false);
});
test("hidden and SEO uploads block persistence and replacing them restores save availability", () => {
  let document = createEditorDocument(); assert.equal(hasImagesBlockingSave(document), false);
  document = editorDocumentReducer(document, { type: "image/upload", target: { kind: "social" }, assetId: "local-file" });
  document.sections.hero = false;
  assert.equal(hasImagesBlockingSave(document), true);
  document = editorDocumentReducer(document, { type: "image/reset", target: { kind: "social" } });
  assert.equal(hasImagesBlockingSave(document), false);
});
test("server document errors map back to the existing editor field paths", () => {
  assert.deepEqual(editorPersistenceErrors({ "document.content.hero.image": "Imagem temporária", "document.business.name": "Nome inválido", name: "Nome interno inválido", expectedRevision: "Conflito" }), {
    "content.hero.image": "Imagem temporária", "business.name": "Nome inválido",
  });
});
