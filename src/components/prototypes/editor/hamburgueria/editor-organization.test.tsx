import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createEditorDocument, editorDocumentReducer, hasEditorChanges } from "./editor-document";
import { HamburgueriaEditorPanel } from "./editor-panel";
import previousControls from "./editor-field-inventory.json";
import { editorSections } from "./editor-navigation";

const noop = () => {};
const ownership = [
  ["header", ["business-name", "business-brandLines-0", "business-foundedYear", "content-header-menuButtonLabel"], ["content-hero-headline-0", "business-tagline"]],
  ["hero", ["content-hero-headline-0", "content-hero-primaryCtaLabel", "content-hero-hoursSummary", "content-hero-serviceSummary"], ["content-header-menuButtonLabel", "content-service-openingHours-0"]],
  ["qualities", ["content-qualities-items-0-title", "content-qualities-items-0-icon"], ["content-story-headline-0"]],
  ["menu", ["content-menu-title", "content-menu-categories-0-label"], ["content-location-mapRoad"]],
  ["story", ["content-story-headline-0", "content-story-featured-ctaLabel"], ["business-foundedYear"]],
  ["howToOrder", ["content-howToOrder-title", "content-service-paymentMethodsText", "content-service-delivery-minimumFeeCents", "contact-whatsapp"], ["content-hero-hoursSummary", "content-service-openingHours-0", "content-service-delivery-neighborhoodsSummary"]],
  ["reviews", ["content-reviews-entries-0-name", "content-demoCopy-reviewDisclaimer"], ["content-demoCopy-footerDisclaimer"]],
  ["location", ["business-address-city", "content-service-openingHours-0", "content-service-delivery-neighborhoodsSummary", "contact-mapsUrl", "contact-instagramUrl", "content-demoCopy-locationDisclaimer"], ["content-service-paymentMethodsText", "content-service-delivery-minimumFeeCents", "content-hero-hoursSummary"]],
  ["faq", ["content-faq-items-0-question", "content-faq-items-0-answer"], ["content-reviews-title"]],
  ["finalCallToAction", ["content-finalCallToAction-title", "content-finalCallToAction-buttonLabel"], ["content-footer-signature-0"]],
  ["footer", ["content-footer-signature-0", "content-footer-navigationLinks-0-target", "business-tagline", "content-demoCopy-footerDisclaimer"], ["content-finalCallToAction-title", "contact-instagramUrl", "content-demoCopy-reviewDisclaimer"]],
] as const;

test("each visual section contains its own controls and excludes unrelated fields", () => {
  const document = createEditorDocument();
  for (const [selectedSection, present, absent] of ownership) {
    const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection={selectedSection} onSelectSection={noop} />);
    for (const id of present) assert.ok(html.includes(`id="editor-${id}"`), `${selectedSection}: missing ${id}`);
    for (const id of absent) assert.ok(!html.includes(`id="editor-${id}"`), `${selectedSection}: misplaced ${id}`);
  }
});

test("navigation follows the landing page and changing selection never changes the document", () => {
  const document = createEditorDocument();
  const original = structuredClone(document);
  const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection="hero" onSelectSection={noop} />);
  const options = [...html.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(options.slice(0, 12), ["appearance", "header", "hero", "qualities", "menu", "story", "howToOrder", "reviews", "location", "faq", "finalCallToAction", "footer"]);
  assert.deepEqual(document, original);
  assert.equal(hasEditorChanges(document), false);
});

test("disabled sections remain editable and expose their visibility control", () => {
  const document = editorDocumentReducer(createEditorDocument(), { type: "section", field: "hero", value: false });
  const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection="hero" onSelectSection={noop} />);
  assert.ok(html.includes('id="editor-content-hero-headline-0"'));
  assert.ok(html.includes("Exibir esta seção"));
  assert.ok(html.includes("oculta"));
});

test("shared identity controls and reset keep the same source of truth", () => {
  let document = editorDocumentReducer(createEditorDocument(), { type: "business", field: "name", value: "Marca compartilhada" });
  for (const selectedSection of ["header", "footer", "location"] as const) {
    const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection={selectedSection} onSelectSection={noop} />);
    assert.ok(html.includes('value="Marca compartilhada"'));
    assert.ok(html.includes("compartilhad"));
  }
  document = editorDocumentReducer(document, { type: "contact", field: "whatsapp", value: "5511999998888" });
  for (const selectedSection of ["menu", "howToOrder", "location"] as const) {
    const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection={selectedSection} onSelectSection={noop} />);
    assert.ok(html.includes('value="5511999998888"'));
    assert.ok(html.includes("compartilhado"));
  }
  document = editorDocumentReducer(document, { type: "reset" });
  assert.deepEqual(document, createEditorDocument());
  assert.equal(hasEditorChanges(document), false);
});

test("all previously available controls survive the visual reorganization", () => {
  const document = createEditorDocument();
  const ids = new Set<string>();
  for (const [selectedSection] of editorSections) {
    const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection={selectedSection} onSelectSection={noop} />);
    for (const match of html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="(editor-[^"]+)"/g)) ids.add(match[1]);
  }
  for (const id of previousControls) assert.ok(ids.has(id), `Previously editable field disappeared: ${id}`);
});

test("editor reports unavailable WhatsApp and removes the warning when a valid number is configured", () => {
  const document = createEditorDocument();
  const render = () => renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection="howToOrder" onSelectSection={noop} />);
  assert.ok(render().includes("WhatsApp não configurado ou inválido"));
  document.contact.whatsapp = "123";
  assert.ok(render().includes("WhatsApp não configurado ou inválido"));
  document.contact.whatsapp = "5511999998888";
  const html = render();
  assert.ok(!html.includes("WhatsApp não configurado ou inválido"));
  assert.ok(html.includes('value="5511999998888"'));
  assert.ok(!html.includes('id="editor-content-demoCopy-orderDialogTitle"'));
});
