import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { brasaBurgerDefaultDocument } from "../data/default-document";
import { HamburgueriaDocumentProvider } from "./document-provider";
import { Header } from "./header";
import { SectionLink } from "./section-link";
import { OrderLink } from "./contact-links";
import { InteractionProvider } from "./interaction-provider";

test("simplified header keeps only brand and menu links and respects disabled destinations", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  const initial = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <Header />
    </HamburgueriaDocumentProvider>,
  );
  assert.match(initial, /href="#inicio"/);
  assert.match(initial, /href="#cardapio"/);
  assert.equal([...initial.matchAll(/<a\s/g)].length, 2);
  assert.doesNotMatch(initial, /<nav|nav-toggle|Abrir menu/);
  document.sections.hero = false;
  document.sections.menu = false;
  document.sections.faq = false;
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <Header />
    </HamburgueriaDocumentProvider>,
  );
  assert.doesNotMatch(html, /href="#(?:inicio|cardapio|duvidas)"/);
  assert.match(html, /href="#conteudo"/);
  assert.doesNotMatch(html, /href="#nossa-historia"/);
});

test("section links disappear when the destination is disabled", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.sections.reviews = false;
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <SectionLink href="#avaliacoes">Avaliações</SectionLink>
    </HamburgueriaDocumentProvider>,
  );
  assert.equal(html, "");
});

test("order links use the contact and business name from the supplied document", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.demo.enabled = false;
  document.business.name = "Outra Hamburgueria";
  document.contact.whatsapp = "5511999999999";
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <InteractionProvider>
        <OrderLink>Pedir</OrderLink>
      </InteractionProvider>
    </HamburgueriaDocumentProvider>,
  );
  assert.match(html, /https:\/\/wa.me\/5511999999999/);
  assert.match(html, /Outra%20Hamburgueria/);
});

test("demo product orders open the configured WhatsApp directly with the product message", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
  document.contact.whatsapp = "+55 (11) 99999-9999";
  document.content.interactions.productOrderMessage = "Quero {productName}, por {price}, da {businessName}.";
  const product = document.content.menu.products[0];
  const html = renderToStaticMarkup(
    <HamburgueriaDocumentProvider document={document}>
      <OrderLink product={product}>Pedir</OrderLink>
    </HamburgueriaDocumentProvider>,
  );
  assert.match(html, /href="https:\/\/wa.me\/5511999999999\?text=/);
  assert.ok(html.includes(encodeURIComponent(product.name)));
  assert.ok(html.includes(encodeURIComponent(document.business.name)));
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /contact-dialog|aria-disabled="true"/);
});

test("missing or invalid WhatsApp disables orders without opening a demo or inventing a number", () => {
  for (const whatsapp of [undefined, "", "   ", "123"]) {
    const document = structuredClone(brasaBurgerDefaultDocument);
    document.contact.whatsapp = whatsapp;
    const html = renderToStaticMarkup(
      <HamburgueriaDocumentProvider document={document}>
        <OrderLink>Pedir pelo WhatsApp</OrderLink>
      </HamburgueriaDocumentProvider>,
    );
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /tabindex="-1"/);
    assert.doesNotMatch(html, /href=|contact-dialog|wa\.me/);
  }
});
