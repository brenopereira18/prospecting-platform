import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compatibleTemplates,
  createLeadDocument,
  normalizeBrazilianPhone,
} from "./template-registry";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";

test("compatibility uses a stable category key rather than its display name", () => {
  assert.equal(compatibleTemplates("hamburgueria")[0].id, "brasa-burger");
  for (const key of [null, "", "restaurante", "Hamburgueria"])
    assert.deepEqual(compatibleTemplates(key), []);
});

test("lead mapping personalizes identity while preserving all demonstrative sections and content", () => {
  const original = structuredClone(brasaBurgerDefaultDocument);
  const doc = createLeadDocument({
    name: "Urban Burger",
    address: "Av. Principal, 30 - Centro",
    phone: "(11) 99999-8888",
    rating: 4.3,
    userRatingCount: 27,
  });
  assert.equal(doc.business.name, "Urban Burger");
  assert.equal(doc.business.brandLines.join(" ").trim(), "Urban Burger");
  assert.equal(doc.business.address.street, "Av. Principal, 30 - Centro");
  assert.equal(doc.business.foundedYear, original.business.foundedYear);
  assert.equal(doc.contact.whatsapp, original.contact.whatsapp);
  assert.deepEqual(doc.content.reviews, {
    ...original.content.reviews,
    rating: 4.3,
    count: 27,
    ratingSource: "lead",
    countSource: "lead",
  });
  assert.deepEqual(doc.content.menu, original.content.menu);
  assert.deepEqual(doc.sections, original.sections);
  assert.equal(doc.contact.instagramUrl, original.contact.instagramUrl);
  assert.equal(doc.seo.canonicalUrl, original.seo.canonicalUrl);
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
  assert.deepEqual(brasaBurgerDefaultDocument, original);
});

test("missing lead data preserves the original demo contact and location configuration", () => {
  const doc = createLeadDocument({
    name: "Casa",
    address: null,
    phone: null,
    rating: null,
    userRatingCount: null,
  });
  assert.deepEqual(doc.sections, brasaBurgerDefaultDocument.sections);
  assert.deepEqual(doc.contact, brasaBurgerDefaultDocument.contact);
  assert.deepEqual(
    doc.business.address,
    brasaBurgerDefaultDocument.business.address,
  );
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
  assert.equal(normalizeBrazilianPhone("(11) 99999-8888"), "5511999998888");
  assert.equal(normalizeBrazilianPhone("+55 (11) 3333-4444"), "551133334444");
  assert.equal(normalizeBrazilianPhone("123"), "");
});
