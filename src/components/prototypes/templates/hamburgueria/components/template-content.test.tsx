import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { brasaBurgerDefaultDocument } from "../data/default-document";
import {
  hamburgueriaPrototypeDocumentSchema,
  type HamburgueriaPrototypeDocument,
} from "../schema/hamburgueria.schema";
import { HamburgueriaDocumentProvider } from "./document-provider";
import { formatPriceParts } from "../lib/format";

// Node does not have Next's static-image loader. Load the actual bytes rather
// than replacing the visual components, and retain the real image dimensions.
const assetRequire = createRequire(`${process.cwd()}/package.json`);
assetRequire.extensions[".webp"] = (module, filename) => {
  const bytes = readFileSync(filename);
  const size = assetRequire("next/dist/compiled/image-size").default(bytes);
  module.exports = {
    src: `data:image/webp;base64,${bytes.toString("base64")}`,
    width: size.width,
    height: size.height,
  };
};

async function render(document: HamburgueriaPrototypeDocument) {
  const { HamburgueriaContent } = await import("./content");
  return renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <HamburgueriaContent document={document} />
    </HamburgueriaDocumentProvider>,
  );
}

test("business name and hero headline follow the supplied document", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.business.name = "Burger do Bairro";
  document.business.brandLines = ["BURGER", "DO BAIRRO"];
  document.content.hero.headline = ["SABOR DO BAIRRO", "NA SUA MESA"];
  const html = await render(document);
  assert.match(html, /BURGER DO BAIRRO|Burger do Bairro/);
  assert.match(html, /SABOR DO BAIRRO/);
  assert.doesNotMatch(html, /NA BRASA\.<br/);
});

test("menu and featured price come from the same document product", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  const product = document.content.menu.products.find(
    (item) => item.id === document.content.story.featured.productId,
  )!;
  product.name = "COMBO PERSONALIZADO";
  product.priceCents = 5123;
  const html = await render(document);
  assert.match(html, /COMBO PERSONALIZADO/);
  assert.match(html, /51,23/);
  assert.match(html, /51<span>,23<\/span>/);
  assert.doesNotMatch(html, /R\$ 39<span>,90<\/span>/);
});

test("WhatsApp destination and product message use the supplied document", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.demo.enabled = false;
  document.contact.whatsapp = "5511888888888";
  document.content.menu.products[0].name = "Burger especial";
  const html = await render(document);
  assert.match(html, /https:\/\/wa.me\/5511888888888/);
  assert.match(html, /Burger%20especial/);
});

test("reviews and their stars follow the document ratings", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.reviews.rating = 2;
  document.content.reviews.entries = [
    {
      id: "nova-avaliacao",
      name: "Cliente novo",
      initials: "CN",
      role: "Cliente",
      quote: "Depoimento personalizado.",
      rating: 3,
    },
  ];
  const html = await render(document);
  assert.match(html, /Depoimento personalizado/);
  assert.doesNotMatch(html, /Marina Costa/);
  assert.match(html, /aria-label="2 de 5 estrelas"/);
  assert.match(html, /aria-label="3 de 5 estrelas"/);
});

test("disabled sections do not render and have no navigation destinations", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.sections.hero = false;
  document.sections.menu = false;
  document.sections.reviews = false;
  const html = await render(document);
  assert.doesNotMatch(
    html,
    /(?:id|href)="(?:#)?(?:inicio|cardapio|avaliacoes)"/,
  );
  assert.match(html, /<header/);
  assert.match(html, /<footer/);
});

test("renamed and removed categories do not rely on burgers or combos IDs", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.menu.categories = [{ id: "especiais", label: "Especiais" }];
  document.content.menu.products = document.content.menu.products.filter(
    (product) => product.id === document.content.story.featured.productId,
  );
  document.content.menu.products[0].categoryId = "especiais";
  document.content.menu.defaultCategoryId = "especiais";
  document.content.story.featured.targetCategoryId = "especiais";
  hamburgueriaPrototypeDocumentSchema.parse(document);
  const html = await render(document);
  assert.match(html, /aria-pressed="true"[^>]*>Especiais/);
  assert.doesNotMatch(html, /BRASA CLÁSSICO<\/h3>/);
  assert.match(html, /COMBO CLÁSSICO<\/h3>/);
});

test("missing runtime references degrade without throwing", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.menu.categories = [];
  document.content.menu.products = [];
  const html = await render(document);
  assert.match(html, /<footer/);
  assert.doesNotMatch(html, /class="combo-price/);
});

test("default content retains the current Brasa Burger copy and prices", async () => {
  const html = await render(brasaBurgerDefaultDocument);
  for (const text of [
    "NA BRASA.",
    "NO CAPRICHO.",
    "OS FAVORITOS DA CASA",
    "BRASA CLÁSSICO",
    "27,90",
    "É BOM. MAS PODE PERGUNTAR.",
    "Marina Costa",
    "Rua das Brasas, 180",
    "Bora de Brasa",
    "Fome de coisa boa.",
  ]) {
    assert.ok(html.includes(text), `Missing default content: ${text}`);
  }
});

test("unresolved uploads are reported and render a fallback without fictitious URLs", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.hero.image = {
    source: "upload",
    assetId: "foto-sem-upload",
    alt: "Foto personalizada",
  };
  const { prepareUploadImages } = await import("../lib/images");
  const issues: string[] = [];
  assert.deepEqual(
    prepareUploadImages(document, undefined, (issue) => issues.push(issue)),
    {},
  );
  assert.ok(issues.some((issue) => issue.includes("foto-sem-upload")));
  const html = await render(document);
  assert.match(
    html,
    /aria-label="Foto personalizada" data-image-status="unresolved"/,
  );
  assert.doesNotMatch(html, /src="[^"]*foto-sem-upload/);
});

test("image resolver accepts known template assets and validates resolved upload sources", async () => {
  const { resolveHamburgueriaImage, prepareUploadImages } =
    await import("../lib/images");
  assert.ok(
    resolveHamburgueriaImage({ source: "template", key: "hero", alt: "Foto" }),
  );
  assert.equal(
    resolveHamburgueriaImage({
      source: "template",
      key: "inexistente",
      alt: "Foto",
    }),
    null,
  );
  const document = structuredClone(brasaBurgerDefaultDocument);
  const ref = {
    source: "upload" as const,
    assetId: "foto-enviada",
    alt: "Foto",
  };
  document.content.hero.image = ref;
  const issues: string[] = [];
  const invalid = prepareUploadImages(
    document,
    () => ({ src: "javascript:alert(1)", width: 800, height: 600 }),
    (issue) => issues.push(issue),
  );
  assert.equal(resolveHamburgueriaImage(ref, invalid), null);
  assert.equal(issues.length, 1);
  assert.deepEqual(
    prepareUploadImages(
      document,
      () => ({ src: undefined as unknown as string, width: 800, height: 600 }),
      () => {},
    ),
    {},
  );
  const resolved = {
    src: "/uploads/foto-existente.webp",
    width: 800,
    height: 600,
  };
  const uploads = prepareUploadImages(
    document,
    (id) => (id === "foto-enviada" ? resolved : undefined),
    () => assert.fail("unexpected resolution error"),
  );
  assert.deepEqual(resolveHamburgueriaImage(ref, uploads), resolved);
});

test("featured price formatting preserves currency placement for the document locale", () => {
  assert.deepEqual(formatPriceParts(5123, "de-DE", "EUR"), {
    main: "51",
    fraction: ",23",
    suffix: "\u00a0€",
  });
});
