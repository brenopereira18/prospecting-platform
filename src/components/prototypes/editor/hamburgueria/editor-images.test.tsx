import "../../templates/hamburgueria/lib/image-test-loader";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { hamburgueriaImageOptions, type HamburgueriaImageKey } from "../../templates/hamburgueria/lib/image-catalog";
import { resolveHamburgueriaImage } from "../../templates/hamburgueria/lib/images";
import { HAMBURGUERIA_TEMPLATE_ASSETS, hamburgueriaPrototypeDocumentSchema } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import { HamburgueriaDocumentProvider } from "../../templates/hamburgueria/components/document-provider";
import { HamburgueriaContent } from "../../templates/hamburgueria/components/content";
import { createEditorDocument, editorDocumentReducer, getPreviewDocument, hasEditorChanges, validateEditorDocument } from "./editor-document";
import { canRemoveEditorImage, getDefaultEditorImage, getEditorImage, getEditorImagePath, type EditorImageTarget } from "./editor-images";
import { EditorImageGallery, EditorImagePicker } from "./editor-image-picker";
import { HamburgueriaEditorPanel } from "./editor-panel";

const noop = () => {};
const targets: EditorImageTarget[] = [{ kind: "hero" }, { kind: "story" }, { kind: "location" }, { kind: "social" }];

test("catalog lists every supported asset once and resolves real image dimensions", () => {
  assert.deepEqual(hamburgueriaImageOptions.map(option => option.key), [...HAMBURGUERIA_TEMPLATE_ASSETS]);
  assert.equal(new Set(hamburgueriaImageOptions.map(option => option.key)).size, 5);
  for (const option of hamburgueriaImageOptions) {
    const resolved = resolveHamburgueriaImage({ source: "template", key: option.key, alt: option.alt });
    assert.ok(resolved && resolved.width > 0 && resolved.height > 0, option.key);
    assert.ok(option.label.trim() && option.alt.trim());
  }
});

test("selection updates only the requested image and preserves alt and focal point immutably", () => {
  const document = createEditorDocument();
  document.content.hero.image.focalPoint = { x: 19, y: 73 };
  const before = structuredClone(document);
  const next = editorDocumentReducer(document, { type: "image/select", target: { kind: "hero" }, key: "classic" });
  assert.deepEqual(next.content.hero.image, { source: "template", key: "classic", alt: before.content.hero.image.alt, focalPoint: { x: 19, y: 73 } });
  assert.notEqual(next.content.hero.image.focalPoint, document.content.hero.image.focalPoint);
  assert.deepEqual(document, before);
  assert.equal(next.content.menu, document.content.menu);
  assert.equal(next.content.location, document.content.location);
  assert.ok(hasEditorChanges(next));
  assert.deepEqual(validateEditorDocument(next), {});
});

test("each image target supports every catalog choice and remains compatible with Zod", () => {
  const document = createEditorDocument();
  const product = { kind: "product", productId: document.content.menu.products[0].id } as const;
  for (const target of [...targets, product]) for (const { key } of hamburgueriaImageOptions) {
    const changed = editorDocumentReducer(document, { type: "image/select", target, key });
    assert.equal(getEditorImage(changed, target)?.source, "template");
    assert.equal((getEditorImage(changed, target) as { key: string }).key, key);
    assert.ok(hamburgueriaPrototypeDocumentSchema.safeParse(changed).success);
    assert.doesNotMatch(JSON.stringify(changed), /data:image|\/_next\/static/);
  }
});

test("restoring each image uses the original document and restores its metadata", () => {
  const document = createEditorDocument();
  for (const target of [...targets, { kind: "product", productId: document.content.menu.products[0].id } as const]) {
    let changed = editorDocumentReducer(document, { type: "image/select", target, key: "interior" });
    changed = editorDocumentReducer(changed, { type: "image/alt", target, value: "Legenda alterada" });
    const reset = editorDocumentReducer(changed, { type: "image/reset", target });
    assert.deepEqual(getEditorImage(reset, target), getDefaultEditorImage(target));
    assert.equal(hasEditorChanges(reset), false);
  }
  assert.deepEqual(document, brasaBurgerDefaultDocument);
});

test("product images follow stable IDs after reordering and leave the Story image independent", () => {
  let document = createEditorDocument();
  const id = document.content.menu.products[0].id;
  const storyImage = structuredClone(document.content.story.featured.image);
  document = editorDocumentReducer(document, { type: "menu/product/move", id, direction: 1 });
  document = editorDocumentReducer(document, { type: "image/select", target: { kind: "product", productId: id }, key: "veggie" });
  assert.equal(getEditorImagePath(document, { kind: "product", productId: id }), "content.menu.products.1.image");
  assert.equal(document.content.menu.products[1].image?.source, "template");
  assert.equal((document.content.menu.products[1].image as { key: string }).key, "veggie");
  assert.deepEqual(document.content.story.featured.image, storyImage);
  document = editorDocumentReducer(document, { type: "image/reset", target: { kind: "product", productId: id } });
  assert.deepEqual(document.content.menu.products[1].image, getDefaultEditorImage({ kind: "product", productId: id }));
});

test("required images cannot be removed and products need an icon before removal", () => {
  let document = createEditorDocument();
  for (const kind of ["hero", "story", "location"] as const) {
    assert.equal(canRemoveEditorImage(document, { kind }), false);
    assert.equal(editorDocumentReducer(document, { type: "image/remove", target: { kind } }), document);
  }
  const target = { kind: "product", productId: document.content.menu.products[0].id } as const;
  assert.equal(canRemoveEditorImage(document, target), false);
  assert.equal(editorDocumentReducer(document, { type: "image/remove", target }), document);
  document = editorDocumentReducer(document, { type: "menu/product/edit", id: target.productId, changes: { icon: "burger" } });
  document = editorDocumentReducer(document, { type: "image/remove", target });
  assert.equal(getEditorImage(document, target), undefined);
  assert.deepEqual(validateEditorDocument(document), {});
});

test("new products can select and restore without borrowing another product's default", () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, { type: "menu/product/add", id: "produto-novo", categoryId: document.content.menu.categories[0].id });
  const target = { kind: "product", productId: "produto-novo" } as const;
  assert.equal(getDefaultEditorImage(target), undefined);
  document = editorDocumentReducer(document, { type: "image/select", target, key: "bacon" });
  assert.equal(getEditorImage(document, target)?.alt, "Novo produto");
  document = editorDocumentReducer(document, { type: "image/reset", target });
  assert.equal(getEditorImage(document, target), undefined);
  assert.deepEqual(validateEditorDocument(document), {});
});

test("optional social image can be added, removed and reset without changing the default", () => {
  const document = createEditorDocument();
  const target = { kind: "social" } as const;
  let changed = editorDocumentReducer(document, { type: "image/select", target, key: "hero" });
  assert.ok(changed.seo.socialImage?.alt);
  changed = editorDocumentReducer(changed, { type: "image/remove", target });
  assert.equal(changed.seo.socialImage, undefined);
  assert.deepEqual(validateEditorDocument(changed), {});
  assert.deepEqual(document, brasaBurgerDefaultDocument);
});

test("upload references retain their metadata when replaced without leaking asset IDs into template refs", () => {
  const document = createEditorDocument();
  document.content.hero.image = { source: "upload", assetId: "arquivo-futuro", alt: "Minha fotografia", focalPoint: { x: 0, y: 100 } };
  const changed = editorDocumentReducer(document, { type: "image/select", target: { kind: "hero" }, key: "bacon" });
  assert.deepEqual(changed.content.hero.image, { source: "template", key: "bacon", alt: "Minha fotografia", focalPoint: { x: 0, y: 100 } });
  assert.deepEqual(validateEditorDocument(changed), {});
  assert.equal(document.content.hero.image.source, "upload");
});

test("stale product targets and unknown asset keys are ignored safely", () => {
  const document = createEditorDocument();
  const target = { kind: "product", productId: "produto-excluido" } as const;
  assert.equal(editorDocumentReducer(document, { type: "image/select", target, key: "bacon" }), document);
  assert.equal(editorDocumentReducer(document, { type: "image/reset", target }), document);
  assert.equal(editorDocumentReducer(document, { type: "image/select", target: { kind: "hero" }, key: "__proto__" as HamburgueriaImageKey }), document);
});

test("alt edits preserve the image reference and surface schema errors without blocking typing", () => {
  const document = createEditorDocument();
  const target = { kind: "hero" } as const;
  const changed = editorDocumentReducer(document, { type: "image/alt", target, value: "" });
  assert.equal(changed.content.hero.image.alt, "");
  assert.ok(validateEditorDocument(changed)["content.hero.image.alt"]);
  const valid = editorDocumentReducer(changed, { type: "image/alt", target, value: "Descrição acessível" });
  assert.deepEqual(valid.content.hero.image, { ...document.content.hero.image, alt: "Descrição acessível" });
  assert.deepEqual(validateEditorDocument(valid), {});
});

test("gallery shows real thumbnails and the selected radio without writing to the document", () => {
  const document = createEditorDocument();
  const before = structuredClone(document);
  const html = renderToStaticMarkup(<EditorImageGallery selectedKey="interior" onSelect={noop} name="galeria" />);
  assert.equal([...html.matchAll(/type="radio"/g)].length, 5);
  assert.equal([...html.matchAll(/<img /g)].length, 5);
  assert.match(html, /type="radio"[^>]*checked=""[^>]*value="interior"/);
  assert.deepEqual(document, before);
});

test("image controls belong to their visual sections and keep existing text controls", () => {
  const document = createEditorDocument();
  const expected = { appearance: "seo-socialImage", hero: "content-hero-image", story: "content-story-featured-image", location: "content-location-image" } as const;
  for (const [selectedSection, id] of Object.entries(expected)) {
    const html = renderToStaticMarkup(<HamburgueriaEditorPanel document={document} dispatch={noop} errors={{}} onValidate={noop} selectedSection={selectedSection as keyof typeof expected} onSelectSection={noop} />);
    assert.ok(html.includes(`id="editor-${id}"`), selectedSection);
    assert.ok(html.includes("Confirmar imagem"));
    assert.ok(!html.includes('type="file"'));
    for (const other of Object.values(expected).filter(other => other !== id)) assert.ok(!html.includes(`id="editor-${other}"`));
  }
});

test("picker shows unavailable uploads, field errors and schema-safe removal controls", () => {
  const document = createEditorDocument();
  document.content.hero.image = { source: "upload", assetId: "arquivo-futuro", alt: "Fotografia" };
  const html = renderToStaticMarkup(<EditorImagePicker document={document} dispatch={noop} onValidate={noop} errors={{ "content.hero.image.alt": "Preencha este campo." }} target={{ kind: "hero" }} label="Imagem principal" />);
  assert.ok(html.includes("Imagem indisponível nesta sessão"));
  assert.ok(html.includes("Preencha este campo."));
  assert.ok(!html.includes("Remover imagem"));
  assert.ok(!html.includes('src="arquivo-futuro"'));
});

test("image edits reach the real preview and global reset restores the original document", () => {
  const original = createEditorDocument();
  const render = (document: typeof original) => renderToStaticMarkup(<HamburgueriaDocumentProvider document={document}><HamburgueriaContent document={getPreviewDocument(document)} /></HamburgueriaDocumentProvider>);
  const before = render(original).match(/id="inicio"[\s\S]*?<\/section>/)![0];
  const document = structuredClone(original);
  document.content.hero.image.focalPoint = { x: 19, y: 73 };
  const changed = editorDocumentReducer(document, { type: "image/select", target: { kind: "hero" }, key: "classic" });
  const after = render(changed).match(/id="inicio"[\s\S]*?<\/section>/)![0];
  const src = resolveHamburgueriaImage(changed.content.hero.image)!.src;
  assert.ok(!before.includes(src));
  assert.ok(after.includes(src));
  assert.ok(after.includes("object-position:19% 73%"));
  assert.ok(after.includes(changed.content.hero.image.alt));
  assert.deepEqual(editorDocumentReducer(changed, { type: "reset" }), original);
  assert.deepEqual(original, brasaBurgerDefaultDocument);
});
