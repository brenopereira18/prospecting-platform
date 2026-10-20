import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createEditorDocument, editorDocumentReducer } from "./editor-document";
import { ReviewsFields, FaqFields, QualitiesFields } from "./editor-social-sections";
import { StoryFields, ServiceFields, LocationFields } from "./editor-business-sections";
import { FooterFields, FinalCallToActionFields } from "./editor-commercial-sections";
import { HamburgueriaEditorPanel } from "./editor-panel";

const noop = () => {};

test("section forms expose the real document fields with associated validation errors", () => {
  const document = createEditorDocument();
  const props = { document, dispatch: noop, errors: { "content.reviews.entries.0.name": "Nome obrigatório" }, onValidate: noop };
  for (const [Component, fields] of [
    [ReviewsFields, ["content-reviews-entries-0-name", "content-reviews-entries-0-rating", "Nome obrigatório"]],
    [FaqFields, ["content-faq-items-0-question", "content-faq-items-0-answer"]],
    [QualitiesFields, ["content-qualities-items-0-icon", "content-qualities-items-0-title"]],
    [StoryFields, ["content-story-headline-0", "content-story-featured-ctaLabel"]],
    [ServiceFields, ["content-howToOrder-steps-0-title", "content-service-delivery-minimumFeeCents", "Quantidade fixa: 3"]],
    [LocationFields, ["business-address-postalCode", "content-location-mapRoad", "content-service-delivery-areas-0-feeCents"]],
    [FinalCallToActionFields, ["content-finalCallToAction-buttonLabel"]],
    [FooterFields, ["content-footer-navigationLinks-0-target"]],
  ] as const) {
    const html = renderToStaticMarkup(<Component {...props} />);
    for (const field of fields) assert.ok(html.includes(field), field);
    assert.ok(!html.includes('type="file"'));
  }
  assert.equal(document.content.reviews.entries[0].name, "Marina Costa");
});

test("empty review and FAQ forms show an empty state and the main panel lists every section", () => {
  let document = createEditorDocument();
  for (const item of document.content.reviews.entries) document = editorDocumentReducer(document, { type: "sectionItem/delete", list: "reviews", id: item.id });
  for (const item of document.content.faq.items) document = editorDocumentReducer(document, { type: "sectionItem/delete", list: "faq", id: item.id });
  const props = { document, dispatch: noop, errors: {}, onValidate: noop };
  for (const Component of [ReviewsFields, FaqFields]) {
    const html = renderToStaticMarkup(<Component {...props} />);
    assert.ok(html.includes("Nenhum item cadastrado."));
    assert.ok(html.includes("Confirmar exclusão"));
  }
  const html = renderToStaticMarkup(<HamburgueriaEditorPanel {...props} selectedSection="appearance" onSelectSection={noop} />);
  for (const text of ["Cabeçalho", "Início / Hero", "Cardápio", "Diferenciais", "Nossa História", "Como Pedir", "Avaliações", "Perguntas Frequentes", "Localização", "Chamada Final", "Rodapé", "Visibilidade"]) assert.ok(html.includes(text), text);
});
