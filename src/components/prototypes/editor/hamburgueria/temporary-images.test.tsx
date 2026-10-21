import "../../templates/hamburgueria/lib/image-test-loader";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TemporaryImageRegistry,
  MAX_TEMPORARY_IMAGE_BYTES,
  TEMPORARY_IMAGE_NOTICE,
  validateTemporaryImageFile,
  getDocumentUploadIds,
  type TemporaryImageDependencies,
} from "./temporary-images";
import {
  createEditorDocument,
  editorDocumentReducer,
  getPreviewDocument,
  hasEditorChanges,
  validateEditorDocument,
} from "./editor-document";
import {
  resolveHamburgueriaImage,
  prepareUploadImages,
} from "../../templates/hamburgueria/lib/images";
import { HamburgueriaDocumentProvider } from "../../templates/hamburgueria/components/document-provider";
import { HamburgueriaContent } from "../../templates/hamburgueria/components/content";
import { hamburgueriaPrototypeDocumentSchema } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import { EditorImagePicker } from "./editor-image-picker";
import { HamburgueriaEditorPanel } from "./editor-panel";

function fixture(overrides: Partial<TemporaryImageDependencies> = {}) {
  let serial = 0;
  const revoked: string[] = [];
  const created: string[] = [];
  const registry = new TemporaryImageRegistry({
    createURL: () => {
      const url = `blob:http://localhost:3000/image-${serial}`;
      created.push(url);
      return url;
    },
    revokeURL: (url) => revoked.push(url),
    dimensions: async () => ({ width: 800, height: 600 }),
    createId: () => `local-test-${++serial}`,
    ...overrides,
  });
  return { registry, revoked, created };
}
const validFile = () =>
  new File(
    [
      new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...new Array(24).fill(0),
      ]),
    ],
    "fotografia.png",
    { type: "image/png" },
  );
const hero = { kind: "hero" } as const;

test("accepts JPG/JPEG, PNG and WebP including the exact size limit", () => {
  for (const [name, type] of [
    ["Foto.JPG", "image/jpeg"],
    ["foto.jpeg", "image/jpeg"],
    ["foto.png", "image/png"],
    ["foto.webp", "image/webp"],
  ]) {
    assert.equal(
      validateTemporaryImageFile({
        name,
        type,
        size: MAX_TEMPORARY_IMAGE_BYTES,
      }),
      null,
    );
  }
});

test("rejects invalid MIME types, mismatched extensions, empty files and files larger than 5 MB", () => {
  for (const file of [
    { name: "foto.gif", type: "image/gif", size: 10 },
    { name: "foto.svg", type: "image/svg+xml", size: 10 },
    { name: "foto.png", type: "", size: 10 },
    { name: "foto.txt", type: "image/png", size: 10 },
    { name: "foto.png", type: "__proto__", size: 10 },
    { name: "foto.png", type: "image/png", size: 0 },
    {
      name: "foto.png",
      type: "image/png",
      size: MAX_TEMPORARY_IMAGE_BYTES + 1,
    },
  ])
    assert.ok(validateTemporaryImageFile(file));
  assert.match(
    validateTemporaryImageFile({
      name: "foto.png",
      type: "image/png",
      size: MAX_TEMPORARY_IMAGE_BYTES + 1,
    })!,
    /5 MB/,
  );
});

test("invalid files never allocate an object URL", async () => {
  const { registry, created, revoked } = fixture();
  await assert.rejects(
    registry.prepare(
      new File(["test"], "arquivo.svg", { type: "image/svg+xml" }),
    ),
    /JPG/,
  );
  assert.deepEqual(created, []);
  assert.deepEqual(revoked, []);
});

test("checks real format signatures before decoding and rejects a non-image renamed to PNG", async () => {
  const { registry, revoked, created } = fixture();
  await assert.rejects(
    registry.prepare(
      new File(["not a PNG"], "fake.png", { type: "image/png" }),
    ),
    /conteúdo/,
  );
  assert.deepEqual(revoked, created);
  for (const file of [
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", {
      type: "image/jpeg",
    }),
    validFile(),
    new File(["RIFFabcdWEBP"], "photo.webp", { type: "image/webp" }),
  ]) {
    const prepared = await registry.prepare(file);
    assert.ok(registry.getSnapshot()[prepared.assetId]);
    registry.discard(prepared.assetId);
  }
  assert.equal(revoked.length, created.length);
});

test("prepares dimensions and an asset ID without changing document content before confirmation", async () => {
  const { registry, created } = fixture();
  const document = createEditorDocument();
  const prepared = await registry.prepare(validFile());
  assert.equal(prepared.assetId, "local-test-1");
  assert.deepEqual(prepared.image, {
    src: created[0],
    width: 800,
    height: 600,
    temporary: true,
  });
  assert.deepEqual(registry.getSnapshot()[prepared.assetId], prepared.image);
  registry.reconcile(document);
  assert.ok(
    registry.getSnapshot()[prepared.assetId],
    "pending dialog previews must survive unrelated document changes",
  );
  assert.equal(hasEditorChanges(document), false);
  assert.deepEqual(document, brasaBurgerDefaultDocument);
  registry.clear();
});

test("confirmed uploads create structured references, preserve metadata and pass Zod", async () => {
  const { registry } = fixture();
  const document = createEditorDocument();
  document.content.hero.image.focalPoint = { x: 10, y: 90 };
  const prepared = await registry.prepare(validFile());
  assert.equal(registry.confirm(prepared.assetId), true);
  const next = editorDocumentReducer(document, {
    type: "image/upload",
    target: hero,
    assetId: prepared.assetId,
  });
  registry.reconcile(next);
  assert.deepEqual(next.content.hero.image, {
    source: "upload",
    assetId: prepared.assetId,
    alt: document.content.hero.image.alt,
  });
  assert.deepEqual(validateEditorDocument(next), {});
  hamburgueriaPrototypeDocumentSchema.parse(next);
  assert.ok(hasEditorChanges(next));
  assert.doesNotMatch(JSON.stringify(next), /blob:|data:image|"temporary"/);
  assert.equal(document.content.hero.image.source, "template");
  registry.clear();
});

test("temporary uploads resolve through the existing renderer's resolver interface", async () => {
  const { registry } = fixture();
  const prepared = await registry.prepare(validFile());
  const document = editorDocumentReducer(createEditorDocument(), {
    type: "image/upload",
    target: hero,
    assetId: prepared.assetId,
  });
  registry.confirm(prepared.assetId);
  const uploads = prepareUploadImages(
    document,
    (id) => registry.getSnapshot()[id],
    () => assert.fail("unexpected missing upload"),
  );
  assert.deepEqual(
    resolveHamburgueriaImage(document.content.hero.image, uploads),
    prepared.image,
  );
  assert.ok(
    resolveHamburgueriaImage(
      { source: "template", key: "hero", alt: "Imagem" },
      uploads,
    ),
  );
  registry.clear();
});

test("unmarked blob URLs and unsafe URL formats remain rejected", () => {
  const ref = { source: "upload", assetId: "test", alt: "Imagem" } as const;
  for (const image of [
    { src: "blob:http://localhost:3000/a", width: 100, height: 100 },
    {
      src: "javascript:alert(1)",
      width: 100,
      height: 100,
      temporary: true as const,
    },
    {
      src: "blob:data:text/html,test",
      width: 100,
      height: 100,
      temporary: true as const,
    },
    {
      src: "data:image/png,abc",
      width: 100,
      height: 100,
      temporary: true as const,
    },
    {
      src: "blob:http://localhost:3000/a",
      width: 0,
      height: 100,
      temporary: true as const,
    },
  ])
    assert.equal(resolveHamburgueriaImage(ref, { test: image }), null);
  assert.ok(
    resolveHamburgueriaImage(ref, {
      test: { src: "https://example.com/image.png", width: 100, height: 100 },
    }),
  );
});

test("cancelling a staged image revokes it exactly once and leaves the original document intact", async () => {
  const { registry, revoked } = fixture();
  const document = createEditorDocument();
  const prepared = await registry.prepare(validFile());
  registry.discard(prepared.assetId);
  registry.discard(prepared.assetId);
  registry.clear();
  assert.deepEqual(revoked, [prepared.image.src]);
  assert.deepEqual(registry.getSnapshot(), {});
  assert.deepEqual(document, brasaBurgerDefaultDocument);
});

test("substitution frees the previous resource only after the new document commits", async () => {
  const { registry, revoked } = fixture();
  const first = await registry.prepare(validFile());
  registry.confirm(first.assetId);
  let document = editorDocumentReducer(createEditorDocument(), {
    type: "image/upload",
    target: hero,
    assetId: first.assetId,
  });
  registry.reconcile(document);
  const second = await registry.prepare(validFile());
  registry.confirm(second.assetId);
  document = editorDocumentReducer(document, {
    type: "image/upload",
    target: hero,
    assetId: second.assetId,
  });
  assert.deepEqual(revoked, []);
  registry.discard(second.assetId); // dialog onClose after confirmation must not revoke it.
  assert.deepEqual(revoked, []);
  registry.reconcile(document);
  assert.deepEqual(revoked, [first.image.src]);
  assert.deepEqual(registry.getSnapshot()[second.assetId], second.image);
  registry.clear();
});

test("shared and disabled-section references stay alive until the last reference is removed", async () => {
  const { registry, revoked } = fixture();
  const prepared = await registry.prepare(validFile());
  registry.confirm(prepared.assetId);
  let document = editorDocumentReducer(createEditorDocument(), {
    type: "image/upload",
    target: hero,
    assetId: prepared.assetId,
  });
  document = editorDocumentReducer(document, {
    type: "image/upload",
    target: { kind: "social" },
    assetId: prepared.assetId,
  });
  document.sections.hero = false;
  registry.reconcile(document);
  assert.deepEqual([...getDocumentUploadIds(document)], [prepared.assetId]);
  document = editorDocumentReducer(document, {
    type: "image/reset",
    target: hero,
  });
  registry.reconcile(document);
  assert.deepEqual(revoked, []);
  document = editorDocumentReducer(document, {
    type: "image/remove",
    target: { kind: "social" },
  });
  registry.reconcile(document);
  assert.deepEqual(revoked, [prepared.image.src]);
});

test("product deletion and restoring the default release unused uploads", async () => {
  const { registry, revoked } = fixture();
  const product = await registry.prepare(validFile());
  const main = await registry.prepare(validFile());
  registry.confirm(product.assetId);
  registry.confirm(main.assetId);
  let document = createEditorDocument();
  const id = document.content.menu.products[0].id;
  document = editorDocumentReducer(document, {
    type: "image/upload",
    target: { kind: "product", productId: id },
    assetId: product.assetId,
  });
  document = editorDocumentReducer(document, {
    type: "image/upload",
    target: hero,
    assetId: main.assetId,
  });
  registry.reconcile(document);
  document = editorDocumentReducer(document, {
    type: "menu/product/delete",
    id,
  });
  registry.reconcile(document);
  assert.deepEqual(revoked, [product.image.src]);
  document = editorDocumentReducer(document, { type: "reset" });
  registry.reconcile(document);
  assert.deepEqual(revoked, [product.image.src, main.image.src]);
  assert.deepEqual(document, brasaBurgerDefaultDocument);
});

test("failed decoding and invalid dimensions revoke their object URLs", async () => {
  for (const dimensions of [
    async () => {
      throw new Error("Imagem corrompida");
    },
    async () => ({ width: 0, height: 100 }),
    async () => ({ width: NaN, height: 100 }),
  ]) {
    const { registry, revoked, created } = fixture({ dimensions });
    await assert.rejects(registry.prepare(validFile()));
    assert.deepEqual(revoked, created);
    assert.deepEqual(registry.getSnapshot(), {});
  }
});

test("abort while decoding releases immediately and late results cannot recreate cancelled resources", async () => {
  let complete!: (dimensions: { width: number; height: number }) => void;
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const { registry, revoked, created } = fixture({
    dimensions: () =>
      new Promise((resolve) => {
        complete = resolve;
        notifyStarted();
      }),
  });
  const controller = new AbortController();
  const preparing = registry.prepare(validFile(), controller.signal);
  await started;
  controller.abort();
  assert.deepEqual(revoked, created);
  complete({ width: 100, height: 100 });
  await assert.rejects(preparing, { name: "AbortError" });
  assert.deepEqual(registry.getSnapshot(), {});
  assert.equal(revoked.length, 1);
});

test("already cancelled selection allocates nothing and clearing supports Strict Mode replay", async () => {
  const { registry, created, revoked } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(registry.prepare(validFile(), controller.signal), {
    name: "AbortError",
  });
  assert.deepEqual(created, []);
  await registry.prepare(validFile());
  registry.clear();
  registry.clear();
  assert.equal(revoked.length, 1);
  const second = await registry.prepare(validFile());
  assert.ok(registry.getSnapshot()[second.assetId]);
  registry.clear();
  assert.equal(revoked.length, 2);
});

test("unmount clears pending and confirmed resources and ignores late decoder completion", async () => {
  let complete!: (dimensions: { width: number; height: number }) => void;
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const { registry, created, revoked } = fixture({
    dimensions: () =>
      new Promise((resolve) => {
        complete = resolve;
        notifyStarted();
      }),
  });
  const preparing = registry.prepare(validFile());
  await started;
  registry.clear();
  assert.deepEqual(revoked, created);
  complete({ width: 100, height: 100 });
  await assert.rejects(preparing, { name: "AbortError" });
  assert.deepEqual(registry.getSnapshot(), {});
});

test("upload actions reject URL-shaped asset IDs and stale product targets", () => {
  const document = createEditorDocument();
  assert.equal(
    editorDocumentReducer(document, {
      type: "image/upload",
      target: hero,
      assetId: "blob:http://localhost/123",
    }),
    document,
  );
  assert.equal(
    editorDocumentReducer(document, {
      type: "image/upload",
      target: { kind: "product", productId: "removido" },
      assetId: "local-test",
    }),
    document,
  );
});

test("real preview renders adjusted temporary sources without the Next image proxy", async () => {
  const { registry } = fixture();
  const prepared = await registry.prepare(validFile());
  let document = createEditorDocument();
  document = editorDocumentReducer(document, {
    type: "image/upload",
    target: hero,
    assetId: prepared.assetId,
  });
  document = editorDocumentReducer(document, {
    type: "image/framing",
    target: hero,
    value: { zoom: 1.6, positionX: 20, positionY: 80 },
  });
  registry.confirm(prepared.assetId);
  registry.reconcile(document);
  const uploads = prepareUploadImages(
    document,
    (id) => registry.getSnapshot()[id],
  );
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document} uploads={uploads}>
      <HamburgueriaContent document={getPreviewDocument(document)} />
    </HamburgueriaDocumentProvider>,
  );
  const heroHtml = html.match(/id="inicio"[\s\S]*?<\/section>/)![0];
  assert.ok(heroHtml.includes(`src="${prepared.image.src}"`));
  assert.ok(heroHtml.includes("object-position:20% 80%"));
  assert.ok(heroHtml.includes("transform:scale(1.6)"));
  assert.ok(!heroHtml.includes('data-image-status="unresolved"'));
  assert.ok(!heroHtml.includes("/_next/image?url=blob"));
  assert.ok(html.includes("BRASA CLÁSSICO"));
  registry.clear();
});

test("picker shows computer selection, limits, persistence warning and current temporary thumbnail", async () => {
  const { registry } = fixture();
  const prepared = await registry.prepare(validFile());
  const document = editorDocumentReducer(createEditorDocument(), {
    type: "image/upload",
    target: hero,
    assetId: prepared.assetId,
  });
  registry.confirm(prepared.assetId);
  const temporaryImages = {
    uploads: registry.getSnapshot(),
    prepare: registry.prepare,
    confirm: registry.confirm,
    discard: registry.discard,
    getFile: registry.getFile,
  };
  const props = {
    document,
    temporaryImages,
    dispatch: () => {},
    errors: {},
    onValidate: () => {},
  };
  const html = renderToStaticMarkup(
    <EditorImagePicker {...props} target={hero} label="Imagem principal" />,
  );
  for (const text of [
    "Enviar imagem do computador",
    'type="file"',
    'accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"',
    "5 MB",
    TEMPORARY_IMAGE_NOTICE,
    `src="${prepared.image.src}"`,
    "Imagens do template",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(!html.includes("O arquivo ainda não está disponível"));
  const panel = renderToStaticMarkup(
    <HamburgueriaEditorPanel
      {...props}
      selectedSection="hero"
      onSelectSection={() => {}}
    />,
  );
  assert.ok(panel.includes("Enviar imagem do computador"));
  assert.ok(panel.includes(TEMPORARY_IMAGE_NOTICE));
  registry.clear();
});

test("persisted private images render directly with session cookies, framing and template photos intact", () => {
  const document = createEditorDocument();
  document.content.hero.image = {
    source: "upload",
    assetId: "00000000-0000-4000-8000-000000000001",
    alt: "Foto salva",
    focalPoint: { x: 20, y: 80 },
  };
  const src =
    "/api/prototipos/00000000-0000-4000-8000-000000000002/assets/00000000-0000-4000-8000-000000000001";
  const uploads = prepareUploadImages(document, () => ({
    src,
    width: 4,
    height: 3,
  }));
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document} uploads={uploads}>
      <HamburgueriaContent document={document} />
    </HamburgueriaDocumentProvider>,
  );
  const heroHtml = html.match(/id="inicio"[\s\S]*?<\/section>/)![0];
  assert.ok(heroHtml.includes(`src="${src}"`));
  assert.ok(heroHtml.includes("object-position:20% 80%"));
  assert.ok(!heroHtml.includes("/_next/image?url=%2Fapi"));
  assert.ok(!heroHtml.includes('data-image-status="unresolved"'));
  assert.ok(html.includes("BRASA CLÁSSICO"));
});
