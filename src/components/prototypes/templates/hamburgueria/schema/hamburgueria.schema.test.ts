import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { brasaBurgerDefaultDocument } from "../data/default-document";
import { hamburgueriaPrototypeDocumentSchema } from "./hamburgueria.schema";

function cloneDefaultDocument() {
  return structuredClone(brasaBurgerDefaultDocument);
}

describe("hamburgueriaPrototypeDocumentSchema", () => {
  it("accepts the Brasa Burger default document", () => {
    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(brasaBurgerDefaultDocument)
        .success,
      true,
    );
  });

  it("rejects colors that are not hexadecimal", () => {
    const document = cloneDefaultDocument();
    document.appearance.colors.primary = "#GGGGGG";

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });

  it("rejects negative product prices", () => {
    const document = cloneDefaultDocument();
    document.content.menu.products[0].priceCents = -1;

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });

  it("rejects products linked to a missing category", () => {
    const document = cloneDefaultDocument();
    document.content.menu.products[0].categoryId = "nao-existe";

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });

  it("rejects duplicate product IDs", () => {
    const document = cloneDefaultDocument();
    document.content.menu.products[1].id = document.content.menu.products[0].id;

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });

  it("rejects featured products that do not exist", () => {
    const document = cloneDefaultDocument();
    document.content.story.featured.productId = "produto-ausente";

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });

  it("allows all content sections to be disabled", () => {
    const document = cloneDefaultDocument();
    for (const section of Object.keys(document.sections)) {
      document.sections[section as keyof typeof document.sections] = false;
    }

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      true,
    );
  });

  it("allows blank contact details in a demo document", () => {
    const document = cloneDefaultDocument();
    document.contact.whatsapp = "";
    document.contact.instagramUrl = "";
    document.contact.mapsUrl = "";

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      true,
    );
  });

  it("rejects malformed URLs when contact links are supplied", () => {
    const document = cloneDefaultDocument();
    document.contact.mapsUrl = "not-a-url";

    assert.equal(
      hamburgueriaPrototypeDocumentSchema.safeParse(document).success,
      false,
    );
  });
});
