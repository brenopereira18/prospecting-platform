import assert from "node:assert/strict";
import { test } from "node:test";
import { createEditorDocument, editorDocumentReducer, getPreviewDocument } from "./editor-document";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import { HAMBURGUERIA_MENU_LIMITS as limits, hamburgueriaPrototypeDocumentSchema as schema } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import * as money from "./editor-menu-document";

test("converts reais and centavos exactly without floating point rounding", () => {
  assert.equal(typeof money.parseReais, "function");
  for (const [value, cents] of [["29,90", 2990], ["R$ 29,90", 2990], ["0,01", 1], ["1,05", 105], ["1,1", 110], ["0,29", 29], ["29.90", 2990], ["1.234,56", 123456], ["1000000,00", 100000000]] as const) {
    assert.equal(money.parseReais(value), cents);
    assert.equal(money.parseReais(money.formatEditableReais(cents)), cents);
  }
  for (const value of ["", "-1", "1,", "1,001", "1e2", "Infinity", "1.2.3", "1,2,3", "1000000,01", "90071992547409999"]) assert.equal(money.parseReais(value), null, value);
});

test("adds and renames a category without changing its stable ID or default document", () => {
  const baseline = structuredClone(brasaBurgerDefaultDocument);
  const initial = createEditorDocument();
  const added = editorDocumentReducer(initial, { type: "menu/category/add", id: "especiais" });
  const renamed = editorDocumentReducer(added, { type: "menu/category/edit", id: "especiais", label: "Especiais da casa" });
  assert.deepEqual(renamed.content.menu.categories.at(-1), { id: "especiais", label: "Especiais da casa" });
  assert.deepEqual(initial, baseline);
  assert.deepEqual(brasaBurgerDefaultDocument, baseline);
  schema.parse(renamed);
});

test("reorders categories and ignores boundary moves or duplicate IDs", () => {
  const initial = createEditorDocument();
  const moved = editorDocumentReducer(initial, { type: "menu/category/move", id: "combos", direction: -1 });
  assert.deepEqual(moved.content.menu.categories.slice(0, 2).map(item => item.id), ["combos", "burgers"]);
  assert.deepEqual(editorDocumentReducer(moved, { type: "menu/category/move", id: "combos", direction: -1 }), moved);
  assert.deepEqual(editorDocumentReducer(initial, { type: "menu/category/add", id: "burgers" }), initial);
  schema.parse(moved);
});

test("deleting a category removes linked products and clears the featured references", () => {
  const initial = createEditorDocument();
  const categoryId = initial.content.story.featured.targetCategoryId!;
  const document = editorDocumentReducer(initial, { type: "menu/category/delete", id: categoryId });
  assert.ok(!document.content.menu.products.some(product => product.categoryId === categoryId));
  assert.equal(document.content.story.featured.productId, null);
  assert.equal(document.content.story.featured.targetCategoryId, null);
  schema.parse(document);
});

test("adds and edits a product, preserves its image, and updates the preview document", () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, { type: "menu/product/add", id: "novo", categoryId: "burgers" });
  document = editorDocumentReducer(document, { type: "menu/product/edit", id: "novo", changes: { name: "Novo sabor", description: "Ingredientes do novo sabor", priceCents: 2990, badge: "Novidade", allergens: "Contém leite", vegetarian: true, icon: "leaf" } });
  const product = document.content.menu.products.find(item => item.id === "novo")!;
  assert.equal(product.priceCents, 2990);
  assert.equal(product.name, "Novo sabor");
  assert.equal(product.icon, "leaf");
  assert.equal(product.vegetarian, true);
  assert.equal(getPreviewDocument(document).content.menu, document.content.menu);
  const original = document.content.menu.products[0];
  document = editorDocumentReducer(document, { type: "menu/product/edit", id: original.id, changes: { name: "Nome editado" } });
  assert.deepEqual(document.content.menu.products[0].image, original.image);
  schema.parse(document);
});

test("rejects invalid category assignments and duplicate product IDs", () => {
  const initial = createEditorDocument();
  assert.deepEqual(editorDocumentReducer(initial, { type: "menu/product/add", id: "novo", categoryId: "ausente" }), initial);
  assert.deepEqual(editorDocumentReducer(initial, { type: "menu/product/add", id: initial.content.menu.products[0].id, categoryId: "burgers" }), initial);
  assert.deepEqual(editorDocumentReducer(initial, { type: "menu/product/edit", id: initial.content.menu.products[0].id, changes: { categoryId: "ausente" } }), initial);
});

test("moving the featured product to another category updates its target reference", () => {
  const initial = createEditorDocument();
  const document = editorDocumentReducer(initial, { type: "menu/product/edit", id: initial.content.story.featured.productId!, changes: { categoryId: "drinks" } });
  assert.equal(document.content.story.featured.targetCategoryId, "drinks");
  schema.parse(document);
});

test("reorders products globally and within a category without changing IDs", () => {
  const initial = createEditorDocument();
  const id = initial.content.menu.products[1].id;
  const document = editorDocumentReducer(initial, { type: "menu/product/move", id, direction: -1 });
  assert.equal(document.content.menu.products[0].id, id);
  const interleaved = editorDocumentReducer(initial, { type: "menu/product/edit", id, changes: { categoryId: "drinks" } });
  const nextBurger = initial.content.menu.products[2].id;
  const scoped = editorDocumentReducer(interleaved, { type: "menu/product/move", id: nextBurger, direction: -1, categoryId: "burgers" });
  assert.equal(scoped.content.menu.products[0].id, nextBurger);
  assert.equal(scoped.content.menu.products[1].id, id);
  schema.parse(scoped);
});

test("deleting the featured product clears both references without inventing a replacement", () => {
  const initial = createEditorDocument();
  const document = editorDocumentReducer(initial, { type: "menu/product/delete", id: initial.content.story.featured.productId! });
  assert.equal(document.content.story.featured.productId, null);
  assert.equal(document.content.story.featured.targetCategoryId, null);
  assert.equal(document.content.menu.products.length, initial.content.menu.products.length - 1);
  schema.parse(document);
});

test("adds, edits, reorders and deletes extras in the main document", () => {
  const initial = createEditorDocument();
  let document = editorDocumentReducer(initial, { type: "menu/extra/add", id: "molho" });
  document = editorDocumentReducer(document, { type: "menu/extra/edit", id: "molho", changes: { name: "Molho especial", priceCents: 150 } });
  document = editorDocumentReducer(document, { type: "menu/extra/move", id: "molho", direction: -1 });
  assert.equal(document.content.menu.extras.at(-2)?.name, "Molho especial");
  assert.equal(document.content.menu.extras.at(-2)?.priceCents, 150);
  schema.parse(document);
  document = editorDocumentReducer(document, { type: "menu/extra/delete", id: "molho" });
  assert.deepEqual(document, initial);
});

test("deleting all categories produces a valid empty menu and permits adding again", () => {
  let document = createEditorDocument();
  for (const category of document.content.menu.categories) {
    document = editorDocumentReducer(document, { type: "menu/category/delete", id: category.id });
    schema.parse(document);
  }
  assert.deepEqual(document.content.menu.products, []);
  assert.equal(document.content.menu.defaultCategoryId, null);
  assert.equal(document.content.story.featured.productId, null);
  document = editorDocumentReducer(document, { type: "menu/category/add", id: "reabertura" });
  assert.equal(document.content.menu.defaultCategoryId, "reabertura");
  document = editorDocumentReducer(document, { type: "menu/product/add", id: "lanche", categoryId: "reabertura" });
  schema.parse(document);
});

test("rejects dangling references and partially cleared featured references", () => {
  const document = createEditorDocument();
  document.content.story.featured.productId = null;
  assert.equal(schema.safeParse(document).success, false);
  document.content.story.featured.targetCategoryId = null;
  assert.equal(schema.safeParse(document).success, true);
  document.content.menu.defaultCategoryId = null;
  assert.equal(schema.safeParse(document).success, false);
});

test("deleting every product leaves valid empty categories and no feature", () => {
  const initial = createEditorDocument();
  let document = initial;
  for (const product of initial.content.menu.products) {
    document = editorDocumentReducer(document, { type: "menu/product/delete", id: product.id });
    schema.parse(document);
  }
  assert.equal(document.content.menu.products.length, 0);
  assert.deepEqual(document.content.menu.categories, initial.content.menu.categories);
  assert.equal(document.content.menu.defaultCategoryId, "burgers");
  assert.equal(document.content.story.featured.productId, null);
});

test("removing the default category selects an existing category and unrelated deletion preserves the feature", () => {
  const initial = createEditorDocument();
  let document = editorDocumentReducer(initial, { type: "menu/category/delete", id: "burgers" });
  assert.equal(document.content.menu.defaultCategoryId, "combos");
  assert.deepEqual(document.content.story.featured, initial.content.story.featured);
  document = editorDocumentReducer(document, { type: "menu/category/delete", id: "missing" });
  schema.parse(document);
});

test("enforces item limits, unique extra IDs and integer price bounds", () => {
  let document = createEditorDocument();
  while (document.content.menu.categories.length < limits.categories) document = editorDocumentReducer(document, { type: "menu/category/add", id: `category-${document.content.menu.categories.length}` });
  const full = document;
  assert.equal(editorDocumentReducer(full, { type: "menu/category/add", id: "over-limit" }), full);
  while (document.content.menu.products.length < limits.products) document = editorDocumentReducer(document, { type: "menu/product/add", id: `product-${document.content.menu.products.length}`, categoryId: "burgers" });
  assert.equal(editorDocumentReducer(document, { type: "menu/product/add", id: "over-limit", categoryId: "burgers" }), document);
  while (document.content.menu.extras.length < limits.extras) document = editorDocumentReducer(document, { type: "menu/extra/add", id: `extra-${document.content.menu.extras.length}` });
  assert.equal(editorDocumentReducer(document, { type: "menu/extra/add", id: "over-limit" }), document);
  const initial = createEditorDocument();
  assert.equal(editorDocumentReducer(initial, { type: "menu/extra/add", id: initial.content.menu.extras[0].id }), initial);
  for (const priceCents of [-1, 1.5, limits.priceCents + 1, NaN, Infinity]) {
    assert.equal(editorDocumentReducer(initial, { type: "menu/product/edit", id: initial.content.menu.products[0].id, changes: { priceCents } }), initial);
    assert.equal(editorDocumentReducer(initial, { type: "menu/extra/edit", id: initial.content.menu.extras[0].id, changes: { priceCents } }), initial);
  }
  schema.parse(document);
});
