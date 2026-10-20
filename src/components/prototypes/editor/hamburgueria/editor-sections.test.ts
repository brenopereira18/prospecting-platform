import assert from "node:assert/strict";
import { test } from "node:test";
import { createEditorDocument, editorDocumentReducer as reduce, hasEditorChanges, validateEditorDocument } from "./editor-document";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import { hamburgueriaPrototypeDocumentSchema as schema } from "../../templates/hamburgueria/schema/hamburgueria.schema";

test("review CRUD keeps IDs stable, supports ordering and an empty list", () => {
  const initial = createEditorDocument();
  let doc = reduce(initial, { type: "sectionItem/add", list: "reviews", id: "nova" });
  doc = reduce(doc, { type: "sectionItem/edit", list: "reviews", id: "nova", changes: { name: "Ana", initials: "AN", role: "Cliente", quote: "Ótimo atendimento", rating: 3.5, sourceUrl: "https://example.com/avaliacao" } });
  doc = reduce(doc, { type: "sectionItem/move", list: "reviews", id: "nova", direction: -1 });
  assert.equal(doc.content.reviews.entries.at(-2)?.id, "nova");
  assert.equal(doc.content.reviews.entries.at(-2)?.name, "Ana");
  schema.parse(doc);
  for (const item of doc.content.reviews.entries) doc = reduce(doc, { type: "sectionItem/delete", list: "reviews", id: item.id });
  assert.deepEqual(doc.content.reviews.entries, []);
  schema.parse(doc);
  assert.deepEqual(initial, brasaBurgerDefaultDocument);
});

test("review ratings outside 0–5 are rejected by Zod and optional ratings inherit the summary", () => {
  const initial = createEditorDocument();
  const id = initial.content.reviews.entries[0].id;
  for (const rating of [-0.1, 5.1, NaN, Infinity]) {
    const doc = reduce(initial, { type: "sectionItem/edit", list: "reviews", id, changes: { rating } });
    assert.equal(schema.safeParse(doc).success, false);
  }
  const doc = reduce(initial, { type: "sectionItem/edit", list: "reviews", id, changes: { rating: undefined } });
  schema.parse(doc);
});

test("FAQ CRUD preserves IDs and supports an empty list", () => {
  let doc = reduce(createEditorDocument(), { type: "sectionItem/add", list: "faq", id: "nova" });
  doc = reduce(doc, { type: "sectionItem/edit", list: "faq", id: "nova", changes: { question: "Como chegar?", answer: "Consulte nosso mapa.", demoOnly: false } });
  doc = reduce(doc, { type: "sectionItem/move", list: "faq", id: "nova", direction: -1 });
  assert.equal(doc.content.faq.items.at(-2)?.id, "nova");
  assert.equal(doc.content.faq.items.at(-2)?.question, "Como chegar?");
  for (const item of doc.content.faq.items) doc = reduce(doc, { type: "sectionItem/delete", list: "faq", id: item.id });
  schema.parse(doc);
  assert.deepEqual(doc.content.faq.items, []);
});

test("qualities allow editing icons, reordering and removing down to the required minimum", () => {
  let doc = reduce(createEditorDocument(), { type: "sectionItem/add", list: "qualities", id: "novo" });
  doc = reduce(doc, { type: "sectionItem/edit", list: "qualities", id: "novo", changes: { title: "Entrega rápida", description: "Sempre com capricho", icon: "truck" } });
  doc = reduce(doc, { type: "sectionItem/move", list: "qualities", id: "novo", direction: -1 });
  assert.equal(doc.content.qualities.items.at(-2)?.icon, "truck");
  for (const item of doc.content.qualities.items) doc = reduce(doc, { type: "sectionItem/delete", list: "qualities", id: item.id });
  assert.equal(doc.content.qualities.items.length, 1);
  schema.parse(doc);
});

test("section text edits preserve featured product references, images and other content", () => {
  const initial = createEditorDocument();
  let doc = reduce(initial, { type: "sectionField", path: "content.story.headline.0", value: "Nossa trajetória" });
  doc = reduce(doc, { type: "sectionField", path: "content.story.featured.ctaLabel", value: "Conhecer oferta" });
  doc = reduce(doc, { type: "sectionStrings/edit", list: "paragraphs", index: 0, value: "Nossa história começou aqui." });
  assert.equal(doc.content.story.headline[0], "Nossa trajetória");
  assert.equal(doc.content.story.paragraphs[0], "Nossa história começou aqui.");
  assert.equal(doc.content.story.featured.productId, initial.content.story.featured.productId);
  assert.equal(doc.content.story.featured.targetCategoryId, initial.content.story.featured.targetCategoryId);
  assert.deepEqual(doc.content.story.featured.image, initial.content.story.featured.image);
  assert.deepEqual(doc.content.menu, initial.content.menu);
  assert.deepEqual(initial, brasaBurgerDefaultDocument);
  schema.parse(doc);
});

test("edits service, delivery areas and fixed order steps without changing their shape", () => {
  let doc = createEditorDocument();
  const id = doc.content.howToOrder.steps[0].id;
  doc = reduce(doc, { type: "sectionItem/edit", list: "steps", id, changes: { title: "Escolha seu pedido", body: "Fale com nossa equipe" } });
  doc = reduce(doc, { type: "sectionItem/move", list: "steps", id, direction: 1 });
  doc = reduce(doc, { type: "sectionField", path: "content.service.orderingHoursNote", value: "Pedidos até as 22h" });
  doc = reduce(doc, { type: "sectionField", path: "content.service.modes.delivery", value: false });
  doc = reduce(doc, { type: "sectionField", path: "content.service.paymentMethodsText", value: "Pix e cartão" });
  doc = reduce(doc, { type: "sectionStrings/edit", list: "openingHours", index: 0, value: "Todos os dias: 18h às 22h" });
  doc = reduce(doc, { type: "sectionItem/add", list: "areas", id: "bairro" });
  doc = reduce(doc, { type: "sectionItem/edit", list: "areas", id: "bairro", changes: { name: "Bairro novo", feeCents: 850 } });
  assert.equal(doc.content.howToOrder.steps[1].id, id);
  assert.equal(doc.content.howToOrder.steps.length, 3);
  assert.equal(doc.content.service.openingHours[0], "Todos os dias: 18h às 22h");
  assert.equal(doc.content.service.delivery.areas.at(-1)?.feeCents, 850);
  for (const area of doc.content.service.delivery.areas) doc = reduce(doc, { type: "sectionItem/delete", list: "areas", id: area.id });
  assert.equal(doc.content.service.delivery.areas.length, 1);
  schema.parse(doc);
});

test("edits location, final CTA, footer and notices and resets the whole document", () => {
  let doc = createEditorDocument();
  doc = reduce(doc, { type: "sectionField", path: "business.address.city", value: "Campinas" });
  doc = reduce(doc, { type: "sectionField", path: "business.address.postalCode", value: "13000-000" });
  doc = reduce(doc, { type: "sectionField", path: "content.location.description", value: "Venha conhecer a casa" });
  doc = reduce(doc, { type: "sectionField", path: "content.finalCallToAction.title", value: "Escolha agora" });
  doc = reduce(doc, { type: "sectionField", path: "content.footer.navigationLinks.0.target", value: "faq" });
  doc = reduce(doc, { type: "sectionField", path: "content.footer.signature.0", value: "Assinatura personalizada" });
  doc = reduce(doc, { type: "sectionField", path: "content.demoCopy.footerDisclaimer", value: "Aviso personalizado" });
  assert.equal(doc.business.address.postalCode, "13000-000");
  assert.equal(doc.content.footer.navigationLinks[0].target, "faq");
  assert.equal(hasEditorChanges(doc), true);
  assert.deepEqual(validateEditorDocument(doc), {});
  const reset = reduce(doc, { type: "reset" });
  assert.deepEqual(reset, brasaBurgerDefaultDocument);
  assert.equal(hasEditorChanges(reset), false);
});

test("text lists respect their minimum, maximum and immutable ordering", () => {
  let doc = createEditorDocument();
  doc = reduce(doc, { type: "sectionStrings/add", list: "paragraphs" });
  const last = doc.content.story.paragraphs.length - 1;
  doc = reduce(doc, { type: "sectionStrings/edit", list: "paragraphs", index: last, value: "Novo parágrafo" });
  doc = reduce(doc, { type: "sectionStrings/move", list: "paragraphs", index: last, direction: -1 });
  assert.equal(doc.content.story.paragraphs.at(-2), "Novo parágrafo");
  for (let i = doc.content.story.paragraphs.length - 1; i >= 0; i--) doc = reduce(doc, { type: "sectionStrings/delete", list: "paragraphs", index: i });
  assert.equal(doc.content.story.paragraphs.length, 1);
  for (let i = 0; i < 20; i++) doc = reduce(doc, { type: "sectionStrings/add", list: "openingHours" });
  assert.equal(doc.content.service.openingHours.length, 14);
  schema.parse(doc);
});

test("list limits and duplicate IDs are enforced without affecting the menu", () => {
  let doc = createEditorDocument();
  const menu = doc.content.menu;
  for (const list of ["reviews", "faq", "qualities", "areas"] as const) {
    for (let i = 0; i < 105; i++) doc = reduce(doc, { type: "sectionItem/add", list, id: `${list}-${i}` });
    const before = doc;
    doc = reduce(doc, { type: "sectionItem/add", list, id: `${list}-0` });
    assert.deepEqual(doc, before);
  }
  assert.equal(doc.content.reviews.entries.length, 30);
  assert.equal(doc.content.faq.items.length, 40);
  assert.equal(doc.content.qualities.items.length, 8);
  assert.equal(doc.content.service.delivery.areas.length, 100);
  assert.deepEqual(doc.content.menu, menu);
  doc = reduce(doc, { type: "menu/category/add", id: "nova-categoria" });
  assert.equal(doc.content.menu.categories.at(-1)?.id, "nova-categoria");
  schema.parse(doc);
});

test("out-of-range ordering, duplicate IDs and mandatory empty lists cannot corrupt the document", () => {
  const initial = createEditorDocument();
  assert.deepEqual(reduce(initial, { type: "sectionStrings/move", list: "paragraphs", index: initial.content.story.paragraphs.length, direction: -1 }), initial);
  assert.deepEqual(reduce(initial, { type: "sectionItem/add", list: "reviews", id: initial.content.reviews.entries[0].id }), initial);
  assert.deepEqual(reduce(initial, { type: "sectionItem/move", list: "faq", id: "absent", direction: 1 }), initial);
  const empty = createEditorDocument();
  empty.content.qualities.items = [];
  assert.equal(schema.safeParse(empty).success, false);
  const invalid = reduce(initial, { type: "sectionField", path: "content.reviews.rating", value: 8 });
  assert.match(validateEditorDocument(invalid)["content.reviews.rating"], /5/);
});
