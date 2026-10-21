import "../../templates/hamburgueria/lib/image-test-loader";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEditorDocument,
  editorDocumentReducer,
  hasEditorChanges,
} from "./editor-document";
import { getImageFraming } from "../../templates/hamburgueria/lib/image-framing";
import { resolveHamburgueriaImage } from "../../templates/hamburgueria/lib/images";
import { hamburgueriaPrototypeDocumentSchema } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { HamburgueriaDocumentProvider } from "../../templates/hamburgueria/components/document-provider";
import { HamburgueriaContent } from "../../templates/hamburgueria/components/content";
import { EditorImageFramingDialog } from "./editor-image-framing-dialog";
import { EditorImagePicker } from "./editor-image-picker";
import { readFramingViewport } from "./editor-image-framing";
import { EditorImageUploads } from "./editor-upload";

const hero = { kind: "hero" } as const;
const framing = { zoom: 2, positionX: 15, positionY: 80 };
const noop = () => {};

test("applying framing updates only one use, preserves its identity and marks the editor dirty", () => {
  const original = createEditorDocument(),
    before = structuredClone(original);
  original.content.story.featured.image = { ...original.content.hero.image };
  const next = editorDocumentReducer(original, {
    type: "image/framing",
    target: hero,
    value: framing,
  });
  assert.deepEqual(next.content.hero.image, {
    ...before.content.hero.image,
    framing,
  });
  assert.deepEqual(
    next.content.story.featured.image,
    original.content.story.featured.image,
  );
  assert.deepEqual(original.content.hero.image, before.content.hero.image);
  assert.ok(hasEditorChanges(next));
  assert.ok(hamburgueriaPrototypeDocumentSchema.safeParse(next).success);
});

test("modal draft changes and cancellation do not write; applying reset restores 100% and the default position", () => {
  const original = createEditorDocument(),
    before = structuredClone(original);
  const defaults = { zoom: 1, positionX: 50, positionY: 51 };
  const draft = getImageFraming(original.content.hero.image, defaults);
  assert.deepEqual(draft, defaults);
  draft.zoom = 2;
  draft.positionY = 90;
  assert.deepEqual(original, before); // No editor action is dispatched by draft changes or cancellation.
  const applied = editorDocumentReducer(original, {
    type: "image/framing",
    target: hero,
    value: draft,
  });
  const reset = editorDocumentReducer(applied, {
    type: "image/framing",
    target: hero,
    value: defaults,
  });
  assert.deepEqual(reset.content.hero.image.framing, defaults);
  assert.deepEqual(editorDocumentReducer(applied, { type: "reset" }), before);
});

test("invalid framing and stale targets never corrupt the document", () => {
  const original = createEditorDocument();
  for (const value of [
    { ...framing, zoom: NaN },
    { ...framing, zoom: Infinity },
    { ...framing, zoom: 0.5 },
    { ...framing, positionY: 200 },
  ])
    assert.equal(
      editorDocumentReducer(original, {
        type: "image/framing",
        target: hero,
        value,
      }),
      original,
    );
  assert.equal(
    editorDocumentReducer(original, {
      type: "image/framing",
      target: { kind: "product", productId: "missing" },
      value: framing,
    }),
    original,
  );
  assert.equal(
    editorDocumentReducer(original, {
      type: "image/framing",
      target: { kind: "social" },
      value: framing,
    }),
    original,
  );
});

test("replacing a framed image restores default framing for template and upload sources while retaining alt", () => {
  const original = createEditorDocument();
  original.content.hero.image.focalPoint = { x: 10, y: 20 };
  const adjusted = editorDocumentReducer(original, {
    type: "image/framing",
    target: hero,
    value: framing,
  });
  for (const action of [
    { type: "image/select", target: hero, key: "bacon" },
    { type: "image/upload", target: hero, assetId: randomUUID() },
  ] as const) {
    const next = editorDocumentReducer(adjusted, action);
    assert.equal(next.content.hero.image.framing, undefined);
    assert.equal(next.content.hero.image.focalPoint, undefined);
    assert.equal(next.content.hero.image.alt, original.content.hero.image.alt);
  }
});

test("the real renderer clips scaled images without changing unframed legacy markup or intrinsic image sizes", () => {
  const original = createEditorDocument();
  const render = (document: typeof original) =>
    renderToStaticMarkup(
      <HamburgueriaDocumentProvider document={document}>
        <HamburgueriaContent document={document} />
      </HamburgueriaDocumentProvider>,
    );
  const legacy = render(original);
  assert.ok(!legacy.includes("transform:scale("));
  const document = editorDocumentReducer(original, {
    type: "image/framing",
    target: hero,
    value: framing,
  });
  const html = render(document);
  const section = html.match(/id="inicio"[\s\S]*?<\/section>/)![0];
  assert.ok(section.includes('data-image-slot="hero"'));
  assert.ok(section.includes("overflow:hidden"));
  assert.ok(
    section.includes(
      "object-fit:cover;object-position:15% 80%;transform:scale(2);transform-origin:15% 80%",
    ),
  );
  assert.ok(section.includes('fetchPriority="high"'));
  assert.ok(section.includes('width="1536"'));
});

test("framing dialog exposes native cancellation, keyboard instructions and a labelled 100–300% zoom slider", () => {
  const image = createEditorDocument().content.hero.image;
  const resolved = resolveHamburgueriaImage(image)!;
  const viewport = {
    frame: { width: 400, height: 200 },
    visible: { width: 400, height: 200, left: 0, top: 0 },
    defaults: { zoom: 1, positionX: 50, positionY: 50 },
  };
  const html = renderToStaticMarkup(
    <EditorImageFramingDialog
      image={image}
      resolved={resolved}
      viewport={viewport}
      label="Imagem principal"
      onApply={noop}
      onCancel={noop}
    />,
  );
  for (const text of [
    "<dialog",
    "Ajustar imagem",
    "Prévia do enquadramento",
    "use as setas",
    "Restaurar",
    "Cancelar",
    "Aplicar",
    'type="range"',
    'min="1"',
    'max="3"',
    'value="1"',
    'aria-valuetext="100%"',
    "touch-none",
  ])
    assert.ok(html.includes(text), text);
});

test("framing controls exist only for available landing-page photographs, not the social sharing asset", () => {
  const document = createEditorDocument();
  const render = (target: Parameters<typeof EditorImagePicker>[0]["target"]) =>
    renderToStaticMarkup(
      <EditorImagePicker
        document={document}
        dispatch={noop}
        errors={{}}
        onValidate={noop}
        target={target}
        label="Fotografia"
      />,
    );
  for (const target of [
    hero,
    { kind: "story" },
    { kind: "location" },
    { kind: "product", productId: document.content.menu.products[0].id },
  ] as const)
    assert.ok(render(target).includes("Ajustar imagem"));
  assert.ok(!render({ kind: "social" }).includes("Ajustar imagem"));
  document.content.hero.image = {
    source: "upload",
    assetId: randomUUID(),
    alt: "Indisponível",
  };
  assert.match(
    render(hero),
    /<button[^>]*disabled=""[^>]*>Ajustar imagem<\/button>/,
  );
});

test("preview geometry uses stable markers and preserves the visible crop of an oversized Hero", () => {
  const bounds = {
    left: -100,
    top: -30,
    right: 1300,
    bottom: 570,
    width: 1400,
    height: 600,
  };
  const clip = {
    left: 0,
    top: 0,
    right: 1000,
    bottom: 500,
    width: 1000,
    height: 500,
  };
  const element = {
    dataset: { imageSlot: "hero" },
    getBoundingClientRect: () => bounds,
    closest: () => ({ getBoundingClientRect: () => clip }),
    ownerDocument: {
      defaultView: { getComputedStyle: () => ({ objectPosition: "50% 51%" }) },
    },
  };
  const owner = {
    querySelector: () => ({
      contentDocument: {
        documentElement: { clientWidth: 1440 },
        querySelectorAll: () => [element],
      },
    }),
  } as unknown as Document;
  const result = readFramingViewport(
    owner,
    hero,
    createEditorDocument().content.hero.image,
  );
  assert.deepEqual(result.frame, { width: 1400, height: 600 });
  assert.deepEqual(result.visible, {
    left: -100,
    top: -30,
    width: 1000,
    height: 500,
  });
  assert.deepEqual(result.defaults, { zoom: 1, positionX: 50, positionY: 51 });
  const missing = { querySelector: () => null } as unknown as Document;
  assert.ok(
    readFramingViewport(
      missing,
      hero,
      createEditorDocument().content.hero.image,
    ).visible.width > 0,
  );
});

test("reframing a permanent image changes only JSON and performs no upload", async () => {
  let calls = 0;
  const id = randomUUID();
  const document = createEditorDocument();
  document.content.hero.image = {
    source: "upload",
    assetId: id,
    alt: "Foto permanente",
  };
  const next = editorDocumentReducer(document, {
    type: "image/framing",
    target: hero,
    value: framing,
  });
  const uploads = new EditorImageUploads(randomUUID(), async () => {
    calls++;
    throw new Error("Unexpected upload");
  });
  const prepared = await uploads.prepare(next, () => undefined);
  assert.equal(calls, 0);
  assert.deepEqual(prepared.document.content.hero.image, {
    ...document.content.hero.image,
    framing,
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(prepared.document)).content.hero.image.framing,
    framing,
  );
});
