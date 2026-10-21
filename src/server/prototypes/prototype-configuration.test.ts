import assert from "node:assert/strict";
import { test } from "node:test";
import { prototypeConfigurationSchema } from "../../components/prototypes/schemas/prototype-configuration.schema";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";
import {
  createHamburgueriaDocumentFromConfig,
  configurationFromLead,
} from "./template-registry";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";

const lead = {
  name: "Casa Burger",
  address: "Rua do cadastro, 10",
  phone: "(11) 99999-8888",
  rating: 4.7,
  userRatingCount: 25,
};

test("optional headline personalizes the two Hero lines independently of the footer slogan", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: "Burger Central",
    headline: "SABOR DO BAIRRO.\nDO SEU JEITO.",
    tagline: "Sua pausa favorita.",
  });
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.deepEqual(doc.content.hero.headline, [
    "SABOR DO BAIRRO.",
    "DO SEU JEITO.",
  ]);
  assert.equal(doc.business.tagline, "Sua pausa favorita.");
  const single = createHamburgueriaDocumentFromConfig(
    prototypeConfigurationSchema.parse({
      businessName: "Burger Central",
      headline: "Sabor de casa",
    }),
  );
  assert.deepEqual(single.content.hero.headline, ["Sabor de casa", ""]);
  const windows = createHamburgueriaDocumentFromConfig(
    prototypeConfigurationSchema.parse({
      businessName: "Burger Central",
      headline: `${"A".repeat(60)}\r\n${"B".repeat(60)}`,
    }),
  );
  assert.deepEqual(windows.content.hero.headline, [
    "A".repeat(60),
    "B".repeat(60),
  ]);
});

test("blank new fields and unknown service modes preserve the entire template", () => {
  const before = structuredClone(brasaBurgerDefaultDocument);
  const config = prototypeConfigurationSchema.parse({
    businessName: before.business.name,
    headline: " \n ",
    hamburgueria: { hoursSummary: "  ", deliveryRegion: " " },
  });
  assert.deepEqual(createHamburgueriaDocumentFromConfig(config), before);
  assert.deepEqual(brasaBurgerDefaultDocument, before);
  const prefill = configurationFromLead(lead);
  assert.equal(prefill.headline, "");
  assert.equal(prefill.hamburgueria?.modes, undefined);
});

test("provided hours synchronize Hero, location and footer without keeping an unconfirmed closing rule", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: "Burger Central",
    hamburgueria: { hoursSummary: "Quarta a domingo, das 19h às 23h." },
  });
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.deepEqual(doc.content.service.openingHours, [
    config.hamburgueria!.hoursSummary,
  ]);
  assert.equal(
    doc.content.hero.hoursSummary,
    config.hamburgueria!.hoursSummary,
  );
  assert.equal(
    doc.content.footer.serviceLines[1],
    config.hamburgueria!.hoursSummary,
  );
  assert.equal(doc.content.service.orderingHoursNote, "");
  assert.equal(
    doc.content.footer.serviceLines[0],
    brasaBurgerDefaultDocument.content.footer.serviceLines[0],
  );
  assert.ok(persistablePrototypeDocumentSchema.safeParse(doc).success);
});

test("every supported service combination generates valid and consistent attendance text", () => {
  for (let mask = 1; mask < 8; mask++) {
    const modes = {
      delivery: Boolean(mask & 1),
      pickup: Boolean(mask & 2),
      dineIn: Boolean(mask & 4),
    };
    const config = prototypeConfigurationSchema.parse({
      businessName: "Burger Central",
      hamburgueria: { modes },
    });
    const doc = createHamburgueriaDocumentFromConfig(config);
    assert.deepEqual(doc.content.service.modes, modes);
    assert.equal(
      doc.content.hero.serviceSummary,
      doc.content.footer.serviceLines[0],
    );
    for (const [key, label] of [
      ["delivery", "Delivery"],
      ["pickup", "retirada"],
      ["dineIn", "consumo no local"],
    ] as const)
      assert.equal(
        doc.content.hero.serviceSummary
          .toLowerCase()
          .includes(label.toLowerCase()),
        modes[key],
      );
    if (!modes.delivery) {
      assert.doesNotMatch(
        doc.content.howToOrder.steps[2].body,
        /Entregamos|entrega em/i,
      );
      assert.match(
        doc.content.faq.items.find((item) => item.id === "entrega")!.answer,
        /não.*delivery/i,
      );
    }
    if (!modes.pickup)
      assert.doesNotMatch(
        doc.content.howToOrder.steps[2].body,
        /retirada|buscar/i,
      );
    if (!modes.dineIn) {
      assert.match(
        doc.content.faq.items.find((item) => item.id === "reserva")!.answer,
        /não.*consumo no local/i,
      );
      assert.doesNotMatch(
        doc.content.location.description,
        /reunir a turma|casa descontraída/i,
      );
    }
    assert.deepEqual(doc.sections, brasaBurgerDefaultDocument.sections);
    assert.deepEqual(doc.content.menu, brasaBurgerDefaultDocument.content.menu);
    assert.deepEqual(
      doc.content.reviews,
      brasaBurgerDefaultDocument.content.reviews,
    );
    assert.ok(persistablePrototypeDocumentSchema.safeParse(doc).success);
  }
});

test("delivery region reaches location and delivery FAQ without inventing prices", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: "Burger Central",
    hamburgueria: {
      modes: { delivery: true, pickup: false, dineIn: false },
      deliveryRegion: "Centro e Santa Helena",
    },
  });
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.equal(
    doc.content.service.delivery.neighborhoodsSummary,
    "Centro e Santa Helena",
  );
  const answer = doc.content.faq.items.find(
    (item) => item.id === "entrega",
  )!.answer;
  assert.match(answer, /Centro e Santa Helena/);
  assert.doesNotMatch(answer, /Vila Brasa|R\$/);
  assert.deepEqual(
    doc.content.service.delivery.areas,
    brasaBurgerDefaultDocument.content.service.delivery.areas,
  );
  assert.deepEqual(doc.appearance, brasaBurgerDefaultDocument.appearance);
});

test("a retained hidden delivery-region draft does not apply when delivery personalization is off", () => {
  for (const modes of [
    undefined,
    { delivery: false, pickup: true, dineIn: false },
  ]) {
    const config = prototypeConfigurationSchema.parse({
      businessName: brasaBurgerDefaultDocument.business.name,
      hamburgueria: { modes, deliveryRegion: "Região de uma seleção anterior" },
    });
    const doc = createHamburgueriaDocumentFromConfig(config);
    assert.equal(
      doc.content.service.delivery.neighborhoodsSummary,
      brasaBurgerDefaultDocument.content.service.delivery.neighborhoodsSummary,
    );
    if (!modes) assert.deepEqual(doc, brasaBurgerDefaultDocument);
  }
});

test("new configuration changes only related copy, preserving images, prices, IDs and all unrelated sections", () => {
  const original = structuredClone(brasaBurgerDefaultDocument);
  const config = prototypeConfigurationSchema.parse({
    businessName: original.business.name,
    headline: "NOVA CHAMADA",
    hamburgueria: {
      modes: { delivery: true, pickup: false, dineIn: false },
      hoursSummary: "Quinta a domingo",
      deliveryRegion: "Centro",
    },
  });
  const document = createHamburgueriaDocumentFromConfig(config);
  const unaffected = (doc: typeof document) => {
    const copy = structuredClone(doc) as unknown as Record<string, unknown>;
    for (const path of [
      "confirmedFields",
      "content.hero.headline",
      "content.hero.serviceSummary",
      "content.hero.hoursSummary",
      "content.footer.serviceLines",
      "content.service.modes",
      "content.service.openingHours",
      "content.service.orderingHoursNote",
      "content.service.delivery.neighborhoodsSummary",
      "content.howToOrder.steps.1.body",
      "content.howToOrder.steps.2.body",
      "content.location.description",
      "content.location.eyebrow",
      ...["entrega", "prazo", "reserva"].flatMap((id) => {
        const index = doc.content.faq.items.findIndex((item) => item.id === id);
        return [
          `content.faq.items.${index}.question`,
          `content.faq.items.${index}.answer`,
        ];
      }),
    ]) {
      const keys = path.split(".");
      let record = copy;
      for (const key of keys.slice(0, -1))
        record = record[key] as Record<string, unknown>;
      delete record[keys.at(-1)!];
    }
    return copy;
  };
  assert.deepEqual(unaffected(document), unaffected(original));
  const another = createHamburgueriaDocumentFromConfig(config);
  document.content.menu.products[0].name = "Mudança independente";
  assert.deepEqual(another.content.menu, original.content.menu);
  assert.deepEqual(brasaBurgerDefaultDocument, original);
});

test("new fields reject unsupported service shapes, excessive copy and invalid headlines", () => {
  const base = { businessName: "Burger Central" };
  for (const extra of [
    { headline: "a\nb\nc" },
    { headline: "a".repeat(61) },
    { hamburgueria: { hoursSummary: "a".repeat(101) } },
    { hamburgueria: { deliveryRegion: "a".repeat(241) } },
    {
      hamburgueria: {
        modes: { delivery: false, pickup: false, dineIn: false },
      },
    },
    {
      hamburgueria: {
        modes: { delivery: "true", pickup: false, dineIn: false },
      },
    },
    { hamburgueria: { unknown: true } },
  ])
    assert.equal(
      prototypeConfigurationSchema.safeParse({ ...base, ...extra }).success,
      false,
    );
});

test("configuration prefill uses only known lead fields and leaves unknown fields empty", () => {
  const config = configurationFromLead(lead);
  assert.equal(config.businessName, lead.name);
  assert.equal(config.address.street, lead.address);
  assert.equal(config.contact.phone, "5511999998888");
  assert.equal(config.contact.whatsapp, "");
  assert.equal(config.address.city, "");
  assert.equal(config.tagline, "");
  assert.equal(prototypeConfigurationSchema.safeParse(config).success, true);
});

test("configuration deterministically personalizes the document, preserving template structure and defaults", () => {
  const before = structuredClone(brasaBurgerDefaultDocument);
  const config = configurationFromLead(lead);
  config.businessName = "Casa Personalizada";
  config.tagline = "Sabor da nossa casa";
  config.description = "Uma descrição fornecida pelo usuário.";
  config.contact.whatsapp = "(21) 98888-7777";
  config.contact.instagramUrl = "https://www.instagram.com/casa/";
  config.contact.mapsUrl = "https://maps.google.com/?q=Casa";
  config.address = {
    street: "Rua nova, 32",
    neighborhood: "Centro",
    city: "Niterói",
    state: "RJ",
  };
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.equal(doc.business.name, config.businessName);
  assert.equal(doc.business.tagline, config.tagline);
  assert.deepEqual(doc.business.address, {
    ...before.business.address,
    ...config.address,
  });
  assert.equal(doc.content.hero.description.join(""), config.description);
  assert.equal(doc.content.location.description, config.description);
  assert.equal(doc.seo.description, config.description);
  assert.equal(doc.contact.whatsapp, "5521988887777");
  assert.equal(doc.contact.instagramUrl, config.contact.instagramUrl);
  assert.equal(doc.contact.mapsUrl, config.contact.mapsUrl);
  assert.deepEqual(doc.appearance, before.appearance);
  assert.deepEqual(doc.template, before.template);
  assert.equal(doc.schemaVersion, before.schemaVersion);
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
  assert.deepEqual(createHamburgueriaDocumentFromConfig(config), doc);
  assert.equal(lead.name, "Casa Burger");
  assert.deepEqual(brasaBurgerDefaultDocument, before);
});

test("empty or omitted optional fields preserve the entire original template", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: brasaBurgerDefaultDocument.business.name,
    contact: {},
    address: {},
  });
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.deepEqual(doc, brasaBurgerDefaultDocument);
  const whitespace = structuredClone(config);
  whitespace.tagline = "   ";
  whitespace.description = " \n ";
  whitespace.contact.instagramUrl = "";
  whitespace.address.street = "  ";
  assert.deepEqual(
    createHamburgueriaDocumentFromConfig(whitespace),
    brasaBurgerDefaultDocument,
  );
  assert.deepEqual(
    createHamburgueriaDocumentFromConfig(
      prototypeConfigurationSchema.parse({
        businessName: brasaBurgerDefaultDocument.business.name,
      }),
    ),
    brasaBurgerDefaultDocument,
  );
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
});

test("trusted lead rating and count preserve testimonials and record their own provenance", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: "Burger Central",
  });
  const expected = createHamburgueriaDocumentFromConfig(config);
  expected.content.reviews.rating = 4.3;
  expected.content.reviews.count = 127;
  expected.content.reviews.ratingSource = "lead";
  expected.content.reviews.countSource = "lead";
  const doc = createHamburgueriaDocumentFromConfig(config, {
    rating: 4.3,
    userRatingCount: 127,
  });
  assert.deepEqual(doc, expected);
  assert.deepEqual(
    doc.content.reviews.entries,
    brasaBurgerDefaultDocument.content.reviews.entries,
  );
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
});

test("review metadata preserves missing defaults independently and accepts real zero values", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: brasaBurgerDefaultDocument.business.name,
  });
  assert.deepEqual(
    createHamburgueriaDocumentFromConfig(config, {
      rating: null,
      userRatingCount: null,
    }),
    brasaBurgerDefaultDocument,
  );
  const ratingOnly = createHamburgueriaDocumentFromConfig(config, {
    rating: 4.2,
    userRatingCount: null,
  });
  assert.equal(ratingOnly.content.reviews.rating, 4.2);
  assert.equal(
    ratingOnly.content.reviews.count,
    brasaBurgerDefaultDocument.content.reviews.count,
  );
  assert.equal(ratingOnly.content.reviews.ratingSource, "lead");
  assert.equal(ratingOnly.content.reviews.countSource, "demo");
  const countOnly = createHamburgueriaDocumentFromConfig(config, {
    rating: null,
    userRatingCount: 13,
  });
  assert.equal(
    countOnly.content.reviews.rating,
    brasaBurgerDefaultDocument.content.reviews.rating,
  );
  assert.equal(countOnly.content.reviews.count, 13);
  assert.equal(countOnly.content.reviews.ratingSource, "demo");
  assert.equal(countOnly.content.reviews.countSource, "lead");
  const zero = createHamburgueriaDocumentFromConfig(config, {
    rating: 0,
    userRatingCount: 0,
  });
  assert.equal(zero.content.reviews.rating, 0);
  assert.equal(zero.content.reviews.count, 0);
});

test("partial address changes only the populated property, preserving the default map and remaining address", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: brasaBurgerDefaultDocument.business.name,
    address: { street: "Rua informada, 10" },
  });
  const expected = structuredClone(brasaBurgerDefaultDocument);
  expected.business.address.street = config.address.street;
  expected.confirmedFields = ["business.address.street"];
  assert.deepEqual(createHamburgueriaDocumentFromConfig(config), expected);
});

test("only declared configuration paths can change; all commercial demo content stays intact", () => {
  const config = configurationFromLead(lead);
  config.businessName = "Burger Central";
  config.tagline = "O melhor hambúrguer da cidade.";
  config.description = "Descrição informada pelo estabelecimento.";
  config.contact = {
    phone: "(32) 3333-4444",
    whatsapp: "(32) 99999-9999",
    instagramUrl: "https://www.instagram.com/burgercentral/",
    mapsUrl: "https://maps.google.com/?q=Central",
  };
  config.address = {
    street: "Rua Central, 10",
    neighborhood: "Centro",
    city: "Juiz de Fora",
    state: "MG",
  };
  const doc = createHamburgueriaDocumentFromConfig(config);
  const unchanged = (value: typeof doc) => {
    const copy = structuredClone(value);
    const allowed = [
      "confirmedFields",
      "business.name",
      "business.brandLines",
      "business.tagline",
      "business.address.street",
      "business.address.neighborhood",
      "business.address.city",
      "business.address.state",
      "seo.title",
      "seo.description",
      "contact.phone",
      "contact.whatsapp",
      "contact.instagramUrl",
      "contact.instagramLabel",
      "contact.mapsUrl",
      "content.hero.description",
      "content.location.description",
    ];
    for (const path of allowed) {
      const keys = path.split(".");
      let record = copy as unknown as Record<string, unknown>;
      for (const key of keys.slice(0, -1))
        record = record[key] as Record<string, unknown>;
      delete record[keys.at(-1)!];
    }
    return copy;
  };
  assert.deepEqual(unchanged(doc), unchanged(brasaBurgerDefaultDocument));
  assert.deepEqual(doc.sections, brasaBurgerDefaultDocument.sections);
  assert.deepEqual(doc.content.menu, brasaBurgerDefaultDocument.content.menu);
  assert.deepEqual(
    doc.content.reviews,
    brasaBurgerDefaultDocument.content.reviews,
  );
  assert.deepEqual(doc.content.faq, brasaBurgerDefaultDocument.content.faq);
  assert.deepEqual(doc.content.story, brasaBurgerDefaultDocument.content.story);
  assert.equal(doc.contact.whatsapp, "5532999999999");
  assert.deepEqual(
    doc.content.hero.image,
    brasaBurgerDefaultDocument.content.hero.image,
  );
  assert.deepEqual(
    doc.content.location.image,
    brasaBurgerDefaultDocument.content.location.image,
  );
});

test("name, slogan and WhatsApp example changes only the corresponding identity and contact fields", () => {
  const config = prototypeConfigurationSchema.parse({
    businessName: "Burger Central",
    tagline: "O melhor hambúrguer da cidade.",
    contact: { whatsapp: "(32) 99999-9999" },
    address: {},
  });
  const expected = structuredClone(brasaBurgerDefaultDocument);
  expected.business.name = "Burger Central";
  expected.business.brandLines = ["Burger", "Central"];
  expected.business.tagline = config.tagline;
  expected.contact.whatsapp = "5532999999999";
  expected.seo.title = expected.seo.title.replace(
    brasaBurgerDefaultDocument.business.name,
    "Burger Central",
  );
  assert.deepEqual(createHamburgueriaDocumentFromConfig(config), expected);
});

test("sequential documents own independent collections, image references and sections", () => {
  const before = structuredClone(brasaBurgerDefaultDocument);
  const config = prototypeConfigurationSchema.parse({
    businessName: before.business.name,
    contact: {},
    address: {},
  });
  const first = createHamburgueriaDocumentFromConfig(config);
  const second = createHamburgueriaDocumentFromConfig(config);
  assert.deepEqual(first, before);
  assert.deepEqual(second, before);
  first.content.menu.products[0].priceCents = 1;
  first.content.menu.categories[0].label = "Mudança local";
  first.content.reviews.entries[0].quote = "Mudança local";
  first.content.hero.image.alt = "Outra imagem";
  first.sections.menu = false;
  assert.deepEqual(second, before);
  assert.deepEqual(brasaBurgerDefaultDocument, before);
});

test("configuration validates field errors, protocol, lengths and rejects unknown fields", () => {
  const config = configurationFromLead(lead);
  for (const modify of [
    () => ({ ...config, businessName: " " }),
    () => ({ ...config, description: "x".repeat(321) }),
    () => ({ ...config, contact: { ...config.contact, whatsapp: "123" } }),
    () => ({
      ...config,
      contact: { ...config.contact, instagramUrl: "javascript:alert(1)" },
    }),
    () => ({
      ...config,
      contact: { ...config.contact, mapsUrl: "blob:http://localhost/abc" },
    }),
    () => ({ ...config, userId: "forged" }),
  ])
    assert.equal(
      prototypeConfigurationSchema.safeParse(modify()).success,
      false,
    );
});

test("long optional copy and unicode addresses stay within document limits; explicit international DDI is preserved", () => {
  const config = configurationFromLead({ ...lead, phone: "+1 (415) 555-2671" });
  assert.equal(config.contact.phone, "+14155552671");
  config.contact.phone = "+1 (415) 555-2671";
  config.contact.whatsapp = "+1 (415) 555-2671";
  config.description = "Descrição extensa ".repeat(18).slice(0, 320);
  config.address = {
    street: "漢".repeat(160),
    neighborhood: "漢".repeat(100),
    city: "漢".repeat(100),
    state: "漢".repeat(50),
  };
  const doc = createHamburgueriaDocumentFromConfig(config);
  assert.equal(doc.contact.phone, "14155552671");
  assert.equal(doc.contact.whatsapp, "14155552671");
  assert.ok(doc.content.hero.description.every((line) => line.length <= 180));
  assert.ok((doc.contact.mapsUrl?.length ?? 0) <= 2048);
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
});
