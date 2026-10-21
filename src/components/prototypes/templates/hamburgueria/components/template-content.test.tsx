import "../lib/image-test-loader";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { brasaBurgerDefaultDocument } from "../data/default-document";
import {
  hamburgueriaPrototypeDocumentSchema,
  type HamburgueriaPrototypeDocument,
} from "../schema/hamburgueria.schema";
import { HamburgueriaDocumentProvider } from "./document-provider";
import { formatPriceParts } from "../lib/format";
import {
  createEditorDocument,
  editorDocumentReducer,
  getPreviewDocument,
  validateEditorDocument,
} from "../../../editor/hamburgueria/editor-document";
import {
  editorSections,
  getPreviewSectionId,
} from "../../../editor/hamburgueria/editor-navigation";

async function render(document: HamburgueriaPrototypeDocument) {
  const { HamburgueriaContent } = await import("./content");
  return renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <HamburgueriaContent document={document} />
    </HamburgueriaDocumentProvider>,
  );
}

test("all sections consume scoped surfaces and semantic foregrounds for a custom palette", async () => {
  const document = createEditorDocument();
  document.appearance.colors = {
    primary: "#0044cc",
    secondary: "#fff",
    tertiary: "#121212",
  };
  schemaCheck(document);
  const html = await render(document);
  for (const [element, scope] of [
    ["header", "deep"],
    ["hero", "deep"],
    ["qualities", "secondary"],
    ["combo-panel", "deep"],
    ["story-panel", "brand"],
    ["how-section", "card"],
    ["reviews-section", "secondary"],
    ["faq-section", "soft"],
    ["final-cta", "brand"],
    ["footer", "deep"],
  ])
    assert.ok(html.includes(`${element} color-${scope} `), element);
  assert.match(html, /product-card color-card /);
  assert.match(html, /product-price[^\"]*text-\[var\(--accent\)\]/);
  assert.match(html, /button-yellow[^\"]*\[color:var\(--on-brand\)\]/);
  assert.match(html, /button-dark[^\"]*\[color:var\(--on-secondary\)\]/);
  assert.doesNotMatch(html, /#ffcc33|#9d6500|#c98b00|#d8e3b5/);
});

test("lead draft renders configured identity together with the complete demonstrative menu and testimonials", async () => {
  const { createLeadDocument } = await import(
    "../../../../../server/prototypes/template-registry"
  );
  const document = createLeadDocument({
    name: "Burger Central",
    address: "Rua registrada, 42",
    phone: "11999998888",
    rating: 4.3,
    userRatingCount: 12,
  });
  const html = await render(document);
  assert.ok(html.includes("Burger Central"));
  assert.ok(html.includes("Rua registrada, 42"));
  assert.ok(html.includes('aria-label="4,3 de 5 estrelas"'));
  assert.ok(html.includes("Mais de 12 boas mordidas"));
  assert.ok(html.includes("Mais de 12 avaliações"));
  assert.ok(
    html.includes(`Desde ${brasaBurgerDefaultDocument.business.foundedYear}`),
  );
  assert.ok(html.includes("Conte como foi sua experiência"));
  assert.ok(html.includes("BRASA CLÁSSICO"));
  assert.ok(html.includes('href="#cardapio"'));
  const withYear = editorDocumentReducer(document, {
    type: "sectionField",
    path: "business.foundedYear",
    value: 2020,
  });
  assert.equal(withYear.business.foundedYear, 2020);
  assert.equal(
    document.business.foundedYear,
    brasaBurgerDefaultDocument.business.foundedYear,
  );
  assert.ok((await render(withYear)).includes("Desde 2020"));
});

test("the configured headline and service copy render together with the complete demonstrative template", async () => {
  const { createHamburgueriaDocumentFromConfig } = await import(
    "../../../../../server/prototypes/template-registry"
  );
  const { prototypeConfigurationSchema } = await import(
    "../../../schemas/prototype-configuration.schema"
  );
  const doc = createHamburgueriaDocumentFromConfig(
    prototypeConfigurationSchema.parse({
      businessName: "Burger Central",
      headline: "SABOR DA CIDADE\nNA SUA CASA",
      hamburgueria: {
        modes: { delivery: true, pickup: false, dineIn: false },
        hoursSummary: "Quinta a domingo, das 18h às 23h",
        deliveryRegion: "Centro e Santa Helena",
      },
    }),
  );
  const html = await render(doc);
  for (const text of [
    "SABOR DA CIDADE",
    "NA SUA CASA",
    "Quinta a domingo, das 18h às 23h",
    "Centro e Santa Helena",
    "BRASA CLÁSSICO",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(
    html,
    /Peça pelo WhatsApp ou direto no balcão|Prefere buscar\?|Delivery e retirada encerram/,
  );
  assert.ok(html.includes('id="cardapio"'));
  assert.ok(html.includes('id="nossa-historia"'));
  assert.ok(html.includes('id="avaliacoes"'));
});

test("cleared supporting text stays valid and disappears from the preview without empty text blocks", async () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, {
    type: "hero",
    field: "eyebrow",
    value: "   ",
  });
  document = editorDocumentReducer(document, {
    type: "heroDescription",
    index: 0,
    value: "",
  });
  document = editorDocumentReducer(document, {
    type: "heroDescription",
    index: 1,
    value: "",
  });
  document.business.tagline = "";
  document.business.brandLines[1] = "";
  const {
    hero,
    story,
    menu,
    faq,
    location,
    footer,
    service,
    qualities,
    howToOrder,
    reviews,
  } = document.content;
  hero.headline[1] = "";
  hero.hoursSummary =
    hero.serviceSummary =
    hero.bottomNote =
    hero.badgeText =
      "";
  hero.badgeLines = ["", ""];
  story.eyebrow = "";
  story.paragraphs = ["", "   "];
  story.signature = ["", ""];
  story.featured.description = ["", ""];
  story.featured.priceLabel = "";
  faq.intro = ["", ""];
  faq.headline[1] = "";
  menu.note = menu.vegetarianNote = menu.customizationNote = menu.eyebrow = "";
  menu.products.forEach((product) => {
    product.description = " ";
    product.badge = "";
    product.allergens = "";
  });
  qualities.items.forEach((item) => {
    item.description = "";
  });
  howToOrder.steps.forEach((step) => {
    step.body = "";
  });
  reviews.entries.forEach((review) => {
    review.role = "";
  });
  location.description =
    location.mapPlaceTagline =
    location.mapCaption =
    location.mapRoad =
    location.mapAvenue =
      "";
  footer.serviceLines = footer.signature = ["", ""];
  service.orderingHoursNote =
    service.paymentMethodsText =
    service.pickupFeeText =
      "";
  service.delivery.neighborhoodsSummary = service.delivery.priceRangeText = "";
  assert.deepEqual(validateEditorDocument(document), {});
  schemaCheck(document);
  const html = await render(getPreviewDocument(document));
  for (const marker of [
    "hero-description ",
    "hero-service ",
    "hero-stamp ",
    "hero-bottom ",
    "story-signature ",
    "menu-footer ",
  ])
    assert.ok(!html.includes(marker), marker);
  assert.doesNotMatch(
    html,
    /<(?:p|small|strong)[^>]*>\s*<\/(?:p|small|strong)>/,
  );
  assert.ok(html.includes("BRASA CLÁSSICO"));
  assert.ok(html.includes('href="#cardapio"'));
});

test("essential names, headings, button labels and text limits remain validated", () => {
  for (const mutate of [
    (document: HamburgueriaPrototypeDocument) => {
      document.business.name = "";
    },
    (document: HamburgueriaPrototypeDocument) => {
      document.content.menu.products[0].name = "";
    },
    (document: HamburgueriaPrototypeDocument) => {
      document.content.hero.headline[0] = "";
    },
    (document: HamburgueriaPrototypeDocument) => {
      document.content.hero.primaryCtaLabel = "";
    },
    (document: HamburgueriaPrototypeDocument) => {
      document.content.hero.eyebrow = "x".repeat(121);
    },
  ]) {
    const document = createEditorDocument();
    mutate(document);
    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  }
});

test("partial multiline copy has no orphan breaks and clearing social text leaves no blank link", async () => {
  const document = createEditorDocument();
  document.content.hero.description = ["   ", "Descrição restante"];
  document.content.faq.intro = ["Introdução restante", ""];
  document.content.location.socialLinkPrefix = "";
  document.contact.instagramLabel = "";
  const html = await render(document);
  schemaCheck(document);
  assert.match(
    html,
    /<p class="hero-description [^"]*">Descrição restante<\/p>/,
  );
  assert.match(html, /<p>Introdução restante<\/p>/);
  assert.ok(!html.includes("location-social "));
});

test("menu renders a product list and only reviews remain in a carousel", async () => {
  const html = await render(createEditorDocument());
  assert.equal(
    [...html.matchAll(/aria-roledescription="carrossel"/g)].length,
    1,
  );
  for (const label of ["Produtos anteriores", "Próximos produtos"])
    assert.ok(!html.includes(label), label);
  assert.ok(html.includes('id="menu-grid"'));
  assert.ok(html.includes("BRASA CLÁSSICO"));
  assert.ok(html.includes("Conte como foi sua experiência"));
  assert.ok(!html.includes("Pedir brasa clássico pelo WhatsApp"));
  assert.ok(html.includes("Pedir pelo WhatsApp"));
});

test("menu uses two desktop columns and one mobile column with text before the right-hand image", async () => {
  const html = await render(createEditorDocument());
  assert.ok(html.includes("menu-grid grid grid-cols-2"));
  assert.ok(html.includes("max-[900px]:grid-cols-1"));
  const cards = [
    ...html.matchAll(
      /<article\b[^>]*class="product-card [^"]*"[^>]*>([\s\S]*?)<\/article>/g,
    ),
  ];
  assert.ok(cards.length > 0);
  for (const [, card] of cards) {
    assert.ok(card.indexOf("product-body") < card.indexOf("product-image"));
    assert.ok(card.includes("product-price"));
    assert.ok(!card.includes("product-order"));
    assert.doesNotMatch(card, /<(?:a|button)\b/);
  }
  assert.ok(html.includes('id="reviews-carousel"'));
});

test("reviews remain readable without duplicated testimonials, including short and empty lists", async () => {
  const document = createEditorDocument();
  document.content.reviews.entries.forEach((review) => {
    review.demonstrative = false;
  });
  const html = await render(document);
  assert.ok(html.includes('id="reviews-carousel"'));
  assert.ok(!html.includes("Pausar animação"));
  assert.ok(!html.includes("Retomar animação"));
  assert.ok(html.includes("Deslize para ver mais"));
  assert.ok(!html.includes("reviews-loop-copy"));
  assert.equal([...html.matchAll(/<figure/g)].length, 3);
  document.content.reviews.entries = document.content.reviews.entries.slice(
    0,
    2,
  );
  const two = await render(document);
  assert.equal([...two.matchAll(/<figure/g)].length, 2);
  document.content.reviews.entries = document.content.reviews.entries.slice(
    0,
    1,
  );
  const single = await render(document);
  assert.equal([...single.matchAll(/<figure/g)].length, 1);
  assert.ok(!single.includes("reviews-loop-copy"));
  assert.ok(!single.includes("Pausar animação"));
  document.content.reviews.entries = [];
  const empty = await render(document);
  assert.ok(empty.includes("Conte como foi sua experiência"));
  assert.ok(!empty.includes("reviews-loop-copy"));
});

test("editor destinations exist in the real template without publishing selection styles", async () => {
  const document = createEditorDocument();
  const html = await render(document);
  for (const [section] of editorSections) {
    const id = getPreviewSectionId(section, document.sections);
    if (id)
      assert.ok(
        html.includes(`id="${id}"`),
        `Missing preview target: ${section}`,
      );
  }
  assert.ok(!html.includes("data-prospecta-selected-section"));
  assert.ok(!html.includes("data-prospecta-editor-selection"));
});

test("editor actions update the existing landing page and reset restores its content", async () => {
  let document = editorDocumentReducer(createEditorDocument(), {
    type: "heroHeadline",
    index: 0,
    value: "TÍTULO DO EDITOR",
  });
  document = editorDocumentReducer(document, {
    type: "section",
    field: "menu",
    value: false,
  });
  const edited = await render(document);
  assert.match(edited, /TÍTULO DO EDITOR/);
  assert.doesNotMatch(edited, /(?:id|href)="(?:#)?cardapio"/);
  const restored = await render(
    editorDocumentReducer(document, { type: "reset" }),
  );
  assert.match(restored, /NA BRASA\./);
  assert.match(restored, /id="cardapio"/);
  assert.doesNotMatch(restored, /TÍTULO DO EDITOR/);
});

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

test("general WhatsApp order remains available without individual product buttons", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.demo.enabled = false;
  document.contact.whatsapp = "5511888888888";
  document.business.name = "Hamburgueria teste";
  document.content.menu.products[0].name = "Burger especial";
  const html = await render(document);
  assert.match(html, /https:\/\/wa.me\/5511888888888/);
  assert.match(html, /Hamburgueria%20teste/);
  assert.ok(!html.includes("product-order"));
  assert.ok(html.includes("Burger especial"));
});

test("reviews and their stars follow the document ratings", async () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.reviews.rating = 2;
  document.content.reviews.ratingSource = document.content.reviews.countSource =
    "provided";
  document.content.reviews.entries = [
    {
      id: "nova-avaliacao",
      demonstrative: false,
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
  assert.match(html, /Nenhum produto disponível no momento/);
});

test("editor menu operations reach the real landing page including ordering, extras and cleared features", async () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, {
    type: "menu/product/add",
    id: "novo-editor",
    categoryId: "burgers",
  });
  document = editorDocumentReducer(document, {
    type: "menu/product/edit",
    id: "novo-editor",
    changes: { name: "Produto do editor", priceCents: 1923 },
  });
  document = editorDocumentReducer(document, {
    type: "menu/extra/add",
    id: "extra-editor",
  });
  document = editorDocumentReducer(document, {
    type: "menu/extra/edit",
    id: "extra-editor",
    changes: { name: "Adicional do editor", priceCents: 123 },
  });
  document = editorDocumentReducer(document, {
    type: "menu/category/edit",
    id: "burgers",
    label: "Categoria do editor",
  });
  const html = await render(getPreviewDocument(document));
  assert.match(html, /Produto do editor/);
  assert.match(html, /19,23/);
  assert.match(html, /Adicional do editor/);
  assert.match(html, /1,23/);
  assert.match(html, /Categoria do editor/);
  const id = document.content.menu.products[1].id;
  document = editorDocumentReducer(document, {
    type: "menu/product/move",
    id,
    direction: -1,
  });
  const reordered = await render(document);
  assert.ok(
    reordered.indexOf(document.content.menu.products[0].name + "</h3>") <
      reordered.indexOf(document.content.menu.products[1].name + "</h3>"),
  );
  document = editorDocumentReducer(document, {
    type: "menu/product/delete",
    id: document.content.story.featured.productId!,
  });
  schemaCheck(document);
  const removed = await render(document);
  assert.doesNotMatch(removed, /class="combo-panel /);
  assert.match(removed, /id="nossa-historia"/);
  for (const category of document.content.menu.categories)
    document = editorDocumentReducer(document, {
      type: "menu/category/delete",
      id: category.id,
    });
  schemaCheck(document);
  const empty = await render(document);
  assert.match(empty, /Nenhum produto disponível no momento/);
  assert.match(empty, /<footer/);
});

function schemaCheck(document: HamburgueriaPrototypeDocument) {
  hamburgueriaPrototypeDocumentSchema.parse(document);
}

test("menu and final call to action keep direct orders available when Location is hidden", async () => {
  const document = createEditorDocument();
  document.contact.whatsapp = "5511999999999";
  document.sections.location = false;
  const html = await render(document);
  const menu = html.slice(
    html.indexOf('id="cardapio"'),
    html.indexOf('id="nossa-historia"'),
  );
  const final = html.slice(
    html.indexOf('id="chamada-final"'),
    html.indexOf("<footer"),
  );
  for (const section of [menu, final]) {
    assert.match(section, /href="https:\/\/wa.me\/5511999999999\?text=/);
    assert.ok(section.includes("Pedir pelo WhatsApp"));
  }
  assert.doesNotMatch(html, /href="#onde-estamos"/);
  assert.doesNotMatch(menu, /product-order/);
  document.sections.location = true;
  const withLocation = await render(document);
  const contact = withLocation.slice(
    withLocation.indexOf('id="contato"'),
    withLocation.indexOf('class="location-visual'),
  );
  assert.ok(
    !contact.includes("Canal ilustrativo"),
    "a configured real contact is not described as fictitious",
  );
});

test("imported rating totals and demonstrative testimonials have distinct provenance", async () => {
  const { createLeadDocument } = await import(
    "../../../../../server/prototypes/template-registry"
  );
  const document = createLeadDocument({
    name: "Burger Central",
    address: null,
    phone: null,
    rating: 4.3,
    userRatingCount: 12,
  });
  const html = await render(document);
  assert.ok(!html.includes("Resumo de avaliações do lead"));
  assert.ok(!html.includes("Depoimento ilustrativo"));
  const reviews = html.slice(
    html.indexOf('id="avaliacoes"'),
    html.indexOf('id="onde-estamos"'),
  );
  assert.doesNotMatch(reviews, /href="#i-check"/);
  assert.ok(html.includes("Conte como foi sua experiência"));
  assert.ok(html.includes("BRASA CLÁSSICO"));
});

test("explicit real testimonials lose the illustrative label without marking them verified", async () => {
  const document = createEditorDocument();
  document.content.reviews.entries = [
    {
      ...document.content.reviews.entries[0],
      demonstrative: false,
      name: "Cliente real",
      sourceUrl: "https://example.com/review",
    },
  ];
  const html = await render(document);
  const section = html.slice(
    html.indexOf('id="avaliacoes"'),
    html.indexOf('id="onde-estamos"'),
  );
  assert.ok(section.includes('href="https://example.com/review"'));
  assert.ok(!section.includes("Depoimento ilustrativo"));
  assert.ok(!section.includes('href="#i-check"'));
});

test("legacy demos and partially imported totals do not masquerade as confirmed reviews", async () => {
  const document = createEditorDocument();
  delete document.content.reviews.ratingSource;
  delete document.content.reviews.countSource;
  document.content.reviews.entries.forEach((review) => {
    delete review.demonstrative;
  });
  assert.ok(
    (await render(document)).includes("Conte como foi sua experiência"),
  );
  assert.ok(!(await render(document)).includes("Depoimento ilustrativo"));
  document.content.reviews.ratingSource = "lead";
  schemaCheck(document);
  assert.ok(
    !(await render(document)).includes("Resumo parcialmente ilustrativo"),
  );
  assert.ok(
    !(await render(document)).includes('aria-label="4,9 de 5 estrelas"'),
  );
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
    "Conte como foi sua experiência",
    "Consulte o endereço pelo atendimento.",
    "Pedir pelo WhatsApp",
    "Fome de coisa boa.",
  ]) {
    assert.ok(html.includes(text), `Missing default content: ${text}`);
  }
});

test("section editor changes reach the existing renderer and empty reviews and FAQ remain usable", async () => {
  let document = createEditorDocument();
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "content.story.headline.0",
    value: "HISTÓRIA EDITADA",
  });
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "content.location.description",
    value: "LOCALIZAÇÃO EDITADA",
  });
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "business.address.postalCode",
    value: "13000-000",
  });
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "content.finalCallToAction.title",
    value: "CHAMADA EDITADA",
  });
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "content.footer.signature.0",
    value: "RODAPÉ EDITADO",
  });
  document = editorDocumentReducer(document, {
    type: "sectionItem/edit",
    list: "reviews",
    id: document.content.reviews.entries[0].id,
    changes: { quote: "DEPOIMENTO EDITADO", rating: 2, demonstrative: false },
  });
  document = editorDocumentReducer(document, {
    type: "sectionItem/edit",
    list: "faq",
    id: document.content.faq.items[0].id,
    changes: { question: "PERGUNTA EDITADA", answer: "RESPOSTA EDITADA" },
  });
  document = editorDocumentReducer(document, {
    type: "sectionStrings/edit",
    list: "openingHours",
    index: 0,
    value: "HORÁRIO EDITADO",
  });
  const html = await render(document);
  for (const text of [
    "HISTÓRIA EDITADA",
    "LOCALIZAÇÃO EDITADA",
    "13000-000",
    "CHAMADA EDITADA",
    "RODAPÉ EDITADO",
    "DEPOIMENTO EDITADO",
    "PERGUNTA EDITADA",
    "RESPOSTA EDITADA",
    "HORÁRIO EDITADO",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('aria-label="2 de 5 estrelas"'));
  assert.ok(html.includes("<details"));
  for (const review of document.content.reviews.entries)
    document = editorDocumentReducer(document, {
      type: "sectionItem/delete",
      list: "reviews",
      id: review.id,
    });
  for (const question of document.content.faq.items)
    document = editorDocumentReducer(document, {
      type: "sectionItem/delete",
      list: "faq",
      id: question.id,
    });
  schemaCheck(document);
  const empty = await render(document);
  assert.ok(empty.includes("Conte como foi sua experiência"));
  assert.ok(empty.includes("Nenhuma pergunta cadastrada no momento."));
  assert.ok(empty.includes("BRASA CLÁSSICO"));
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
  const { resolveHamburgueriaImage, prepareUploadImages } = await import(
    "../lib/images"
  );
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
