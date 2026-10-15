import assert from "node:assert/strict";
import { test } from "node:test";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import {
  createEditorDocument,
  editorDocumentReducer,
  getPreviewDocument,
  hasEditorChanges,
  validateEditorDocument,
} from "./editor-document";

test("editor updates appearance and content without mutating the default document", () => {
  const baseline = structuredClone(brasaBurgerDefaultDocument);
  const initial = createEditorDocument();
  let document = editorDocumentReducer(initial, { type: "color", field: "primary", value: "#123456" });
  document = editorDocumentReducer(document, { type: "font", field: "display", value: "caveat" });
  document = editorDocumentReducer(document, { type: "business", field: "name", value: "Burger do Bairro" });
  document = editorDocumentReducer(document, { type: "heroHeadline", index: 0, value: "OUTRO TÍTULO" });
  assert.equal(document.appearance.colors.primary, "#123456");
  assert.equal(document.appearance.fonts.display, "caveat");
  assert.equal(document.business.name, "Burger do Bairro");
  assert.equal(document.content.hero.headline[0], "OUTRO TÍTULO");
  assert.deepEqual(initial, baseline);
  assert.deepEqual(brasaBurgerDefaultDocument, baseline);
  assert.equal(hasEditorChanges(document), true);
});

test("section changes and reset use the same immutable document state", () => {
  const initial = createEditorDocument();
  const edited = editorDocumentReducer(initial, { type: "section", field: "menu", value: false });
  assert.equal(edited.sections.menu, false);
  assert.equal(initial.sections.menu, true);
  const reset = editorDocumentReducer(edited, { type: "reset" });
  assert.deepEqual(reset, brasaBurgerDefaultDocument);
  assert.notEqual(reset, brasaBurgerDefaultDocument);
  assert.notEqual(reset.content.hero, brasaBurgerDefaultDocument.content.hero);
  assert.equal(hasEditorChanges(reset), false);
});

test("temporary color and URL input remains editable and exposes field errors", () => {
  let document = editorDocumentReducer(createEditorDocument(), { type: "color", field: "primary", value: "#12" });
  document = editorDocumentReducer(document, { type: "contact", field: "mapsUrl", value: "https://" });
  assert.equal(document.appearance.colors.primary, "#12");
  assert.equal(document.contact.mapsUrl, "https://");
  const errors = validateEditorDocument(document);
  assert.ok(errors["appearance.colors.primary"]);
  assert.ok(errors["contact.mapsUrl"]);
  assert.equal(getPreviewDocument(document).appearance.colors.primary, "#f5bb16");
  document = editorDocumentReducer(document, { type: "color", field: "primary", value: "#123456" });
  document = editorDocumentReducer(document, { type: "contact", field: "mapsUrl", value: "https://example.com/mapa" });
  assert.deepEqual(validateEditorDocument(document), {});
  assert.equal(getPreviewDocument(document).appearance.colors.primary, "#123456");
});

test("brand, description, buttons and contact edits retain the other document fields", () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, { type: "brandLine", index: 1, value: "DO BAIRRO" });
  document = editorDocumentReducer(document, { type: "heroDescription", index: 0, value: "Descrição personalizada." });
  document = editorDocumentReducer(document, { type: "headerButton", value: "Explorar cardápio" });
  document = editorDocumentReducer(document, { type: "finalButton", value: "Escolher agora" });
  document = editorDocumentReducer(document, { type: "contact", field: "instagramLabel", value: "@burgerdobairro" });
  assert.equal(document.business.brandLines[1], "DO BAIRRO");
  assert.equal(document.content.hero.description[0], "Descrição personalizada.");
  assert.equal(document.content.header.menuButtonLabel, "Explorar cardápio");
  assert.equal(document.content.finalCallToAction.buttonLabel, "Escolher agora");
  assert.equal(document.contact.instagramLabel, "@burgerdobairro");
  assert.deepEqual(document.content.menu, brasaBurgerDefaultDocument.content.menu);
  assert.deepEqual(validateEditorDocument(document), {});
});

test("reverting a field clears the unsaved indicator and label errors describe text limits", () => {
  let document = editorDocumentReducer(createEditorDocument(), { type: "business", field: "name", value: "Outro nome" });
  document = editorDocumentReducer(document, { type: "business", field: "name", value: "Brasa Burger" });
  assert.equal(hasEditorChanges(document), false);
  document = editorDocumentReducer(document, { type: "contact", field: "instagramLabel", value: "x".repeat(81) });
  assert.match(validateEditorDocument(document)["contact.instagramLabel"], /80 caracteres/);
});
