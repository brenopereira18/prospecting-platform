import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { brasaBurgerDefaultDocument } from "../data/default-document";
import { HamburgueriaDocumentProvider } from "./document-provider";
import { Header } from "./header";
import { SectionLink } from "./section-link";
import { OrderLink } from "./contact-links";
import { InteractionProvider } from "./interaction-provider";

test("header removes disabled destinations and keeps its brand link usable", () => {
  const document = structuredClone(brasaBurgerDefaultDocument);
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
  assert.match(html, /href="#nossa-historia"/);
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
