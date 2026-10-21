import "../lib/image-test-loader";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { brasaBurgerDefaultDocument } from "../data/default-document";
import { HamburgueriaContent } from "./content";
import { HamburgueriaDocumentProvider } from "./document-provider";
import { createHamburgueriaDocumentFromConfig } from "../../../../../server/prototypes/template-registry";
import { prototypeConfigurationSchema } from "../../../schemas/prototype-configuration.schema";
import { editorDocumentReducer } from "../../../editor/hamburgueria/editor-document";
import {
  hamburgueriaPrototypeDocumentSchema,
  type HamburgueriaPrototypeDocument,
} from "../schema/hamburgueria.schema";

function render(document: HamburgueriaPrototypeDocument) {
  return renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <HamburgueriaContent document={document} />
    </HamburgueriaDocumentProvider>,
  );
}
function visibleText(html: string) {
  // Closed dialogs and decorative SVG definitions are not visible page copy.
  return html
    .replace(/<(dialog|svg|script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

test("public presentation has no scattered demo notices and retains all sections, menu, prices and image descriptions", () => {
  const before = structuredClone(brasaBurgerDefaultDocument);
  const html = render(before);
  const text = visibleText(html);
  assert.equal(
    /fictíci|ilustrativ|demonstrativ|demonstração|placeholder|localhost|\.svg/i.test(
      text,
    ),
    false,
  );
  for (const id of [
    "inicio",
    "qualidades",
    "cardapio",
    "nossa-historia",
    "como-pedir",
    "avaliacoes",
    "onde-estamos",
    "duvidas",
    "chamada-final",
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(text.includes("BRASA CLÁSSICO"));
  assert.ok(text.includes("27,90"));
  assert.ok(html.includes(`alt="${before.content.hero.image.alt}"`));
  assert.deepEqual(before, brasaBurgerDefaultDocument);
});

test("invented testimonials and totals are replaced by a neutral section, including legacy non-demo documents", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  for (const legacy of [false, true]) {
    if (legacy) {
      document.demo.enabled = false;
      document.contact.whatsapp = "5511999999999";
      delete document.content.reviews.ratingSource;
      delete document.content.reviews.countSource;
      document.content.reviews.entries.forEach((review) => {
        delete review.demonstrative;
      });
    }
    const html = render(document);
    assert.ok(html.includes('id="avaliacoes"'));
    assert.ok(html.includes("Conte como foi sua experiência"));
    assert.equal(
      /Marina Costa|Rafael Lima|Beatriz Santos|800 avaliações|4,9 de 5 estrelas/.test(
        html,
      ),
      false,
    );
  }
});

test("trusted lead totals render without attributing the template's invented quotes to customers", () => {
  const document = createHamburgueriaDocumentFromConfig(
    prototypeConfigurationSchema.parse({ businessName: "Burger Central" }),
    { rating: 4.3, userRatingCount: 12 },
  );
  const html = render(document);
  assert.ok(html.includes('aria-label="4,3 de 5 estrelas"'));
  assert.ok(visibleText(html).includes("12"));
  assert.equal(
    /Resumo de avaliações|Depoimento ilustrativo|Marina Costa/.test(html),
    false,
  );
});

test("only explicitly confirmed testimonials appear and missing individual ratings never inherit fictitious stars", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.content.reviews.entries = [
    {
      id: "real",
      name: "Ana",
      initials: "AN",
      role: "Cliente",
      quote: "Pedido bem preparado.",
      demonstrative: false,
      sourceUrl: "https://example.com/review",
    },
  ];
  let html = render(document);
  assert.ok(visibleText(html).includes("Ana"));
  assert.ok(html.includes('href="https://example.com/review"'));
  assert.ok(!html.includes('aria-label="4,9 de 5 estrelas"'));
  document.content.reviews.entries[0].rating = 4;
  html = render(document);
  assert.ok(html.includes('aria-label="4 de 5 estrelas"'));
});

test("missing location and hours use neutral copy without fictional address or arbitrary city links", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  // A document saved before the clean default still contains the old city link.
  document.contact.mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=S%C3%A3o+Paulo+Brasil";
  const html = render(document);
  assert.equal(
    /Rua das Brasas|Vila Brasa|São Paulo|18h|S%C3%A3o\+Paulo/.test(
      visibleText(html),
    ),
    false,
  );
  assert.ok(
    !html.includes(
      'href="https://www.google.com/maps/search/?api=1&amp;query=S%C3%A3o+Paulo+Brasil"',
    ),
  );
  assert.ok(html.includes("Consulte o endereço pelo atendimento"));
  assert.ok(html.includes("Consulte os horários pelo atendimento"));
});

test("a supplied partial address never mixes with the default city and configured hours remain visible", () => {
  const document = createHamburgueriaDocumentFromConfig(
    prototypeConfigurationSchema.parse({
      businessName: "Burger Central",
      address: { street: "Rua Real, 42" },
      hamburgueria: { hoursSummary: "Quinta a domingo, das 19h às 23h" },
    }),
  );
  const html = render(document);
  const location = html.slice(
    html.indexOf('id="onde-estamos"'),
    html.indexOf('id="duvidas"'),
  );
  assert.ok(visibleText(location).includes("Rua Real, 42"));
  assert.ok(visibleText(location).includes("Quinta a domingo, das 19h às 23h"));
  assert.equal(/Vila Brasa|São Paulo|, SP/.test(visibleText(location)), false);
  assert.ok(location.includes(encodeURIComponent("Rua Real, 42")));
  assert.equal(
    document.business.address.city,
    brasaBurgerDefaultDocument.business.address.city,
    "stored demo fields remain available for editing",
  );
  hamburgueriaPrototypeDocumentSchema.parse(document);
});

test("local development links never become external public destinations and SVG references remain decorative icons", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.contact.mapsUrl = "http://localhost:3000/map.svg";
  document.contact.instagramUrl = "http://127.0.0.1:3000/profile";
  document.contact.instagramLabel = "http://localhost:3000/profile.svg";
  document.content.reviews.entries = [
    {
      ...document.content.reviews.entries[0],
      demonstrative: false,
      sourceUrl: "http://localhost:3000/review",
    },
  ];
  const html = render(document);
  assert.equal(
    /<a\b[^>]*href="https?:\/\/(?:localhost|127\.0\.0\.1)/.test(html),
    false,
  );
  assert.equal(/localhost|\.svg/.test(visibleText(html)), false);
  assert.ok(html.includes('<use href="#i-burger"'));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(html.includes(`alt="${document.content.hero.image.alt}"`));
});

test("editing an address or hours updates the same document and personalized FAQ is not filtered by keywords", () => {
  let document = structuredClone(brasaBurgerDefaultDocument);
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "business.address.city",
    value: "São Paulo",
  });
  document = editorDocumentReducer(document, {
    type: "sectionField",
    path: "business.address.street",
    value: "Avenida Real, 10",
  });
  document = editorDocumentReducer(document, {
    type: "sectionStrings/edit",
    list: "openingHours",
    index: 0,
    value: "Segunda a sábado, 19h às 23h",
  });
  document.content.faq.items[0].answer =
    "A promoção Exemplo da Casa pode ser consultada pelo atendimento.";
  document.content.location.mapCaption = "Entrada pela lateral";
  document.content.location.mapRoad = "Avenida Real";
  const html = render(document);
  assert.ok(visibleText(html).includes("São Paulo"));
  assert.ok(visibleText(html).includes("Avenida Real, 10"));
  assert.ok(visibleText(html).includes("Segunda a sábado, 19h às 23h"));
  assert.ok(visibleText(html).includes("A promoção Exemplo da Casa"));
  assert.ok(!visibleText(html).includes("Entrada pela lateral"));
  assert.ok(!html.includes('class="map-caption'));
  assert.ok(!visibleText(html).includes("Vila Brasa"));
  assert.deepEqual(
    document.content.menu,
    brasaBurgerDefaultDocument.content.menu,
  );
  hamburgueriaPrototypeDocumentSchema.parse(
    JSON.parse(JSON.stringify(document)),
  );
});
