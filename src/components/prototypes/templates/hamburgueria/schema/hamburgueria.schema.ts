import { z } from "zod";

import {
  fontKeySchema,
  hexColorSchema,
  imageReferenceSchema,
  prototypeBaseSchema,
  prototypeIdSchema,
  prototypeTextSchema,
  optionalWebUrlSchema,
} from "../../../schemas/prototype-base.schema";

export const HAMBURGUERIA_TEMPLATE_ASSETS = [
  "bacon",
  "classic",
  "hero",
  "interior",
  "veggie",
] as const;

export const HAMBURGUERIA_FONT_KEYS = [
  "barlow",
  "barlow-condensed",
  "caveat",
] as const;

// Editorial metadata: these paths were explicitly supplied or reviewed, not
// factual values copied from the template. Older documents may omit it.
export const HAMBURGUERIA_CONFIRMABLE_FIELDS = [
  "business.address.street",
  "business.address.neighborhood",
  "business.address.city",
  "business.address.state",
  "business.address.postalCode",
  "contact.mapsUrl",
  "content.hero.hoursSummary",
  "content.service.openingHours",
  "content.footer.serviceLines.1",
  "content.service.orderingHoursNote",
  "content.service.delivery.neighborhoodsSummary",
  "content.service.delivery.priceRangeText",
  "content.service.delivery.minimumFeeCents",
] as const;
export type HamburgueriaConfirmableField =
  (typeof HAMBURGUERIA_CONFIRMABLE_FIELDS)[number];

export const HAMBURGUERIA_ICON_KEYS = [
  "burger",
  "bag",
  "arrow",
  "pin",
  "fire",
  "fries",
  "leaf",
  "clock",
  "truck",
  "check",
  "close",
  "dessert",
  "cup",
] as const;

// Supporting copy can be cleared; identity, headings and action labels remain required.
const supportingTextSchema = (max: number) => z.string().trim().max(max);

const iconKeySchema = z.enum(HAMBURGUERIA_ICON_KEYS);
export const HAMBURGUERIA_MENU_LIMITS = {
  categories: 12,
  products: 100,
  extras: 40,
  priceCents: 100_000_000,
} as const;
const sectionIds = [
  "hero",
  "qualities",
  "menu",
  "story",
  "howToOrder",
  "reviews",
  "location",
  "faq",
  "finalCallToAction",
] as const;

export const hamburgueriaSectionVisibilitySchema = z.strictObject({
  hero: z.boolean(),
  qualities: z.boolean(),
  menu: z.boolean(),
  story: z.boolean(),
  howToOrder: z.boolean(),
  reviews: z.boolean(),
  location: z.boolean(),
  faq: z.boolean(),
  finalCallToAction: z.boolean(),
});

const templateImageSchema = imageReferenceSchema.superRefine((image, ctx) => {
  if (
    image.source === "template" &&
    !(HAMBURGUERIA_TEMPLATE_ASSETS as readonly string[]).includes(image.key)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["key"],
      message: "A imagem não pertence aos assets deste template.",
    });
  }
});

const categorySchema = z.strictObject({
  id: prototypeIdSchema,
  label: prototypeTextSchema(60),
});

const menuProductSchema = z
  .strictObject({
    id: prototypeIdSchema,
    categoryId: prototypeIdSchema,
    name: prototypeTextSchema(100),
    description: supportingTextSchema(600),
    priceCents: z
      .number()
      .int()
      .nonnegative()
      .max(HAMBURGUERIA_MENU_LIMITS.priceCents),
    image: templateImageSchema.optional(),
    icon: iconKeySchema.optional(),
    badge: supportingTextSchema(60).optional(),
    vegetarian: z.boolean().optional(),
    allergens: supportingTextSchema(300).optional(),
  })
  .refine((product) => Boolean(product.image || product.icon), {
    path: ["image"],
    message: "O produto precisa de uma imagem ou ícone.",
  });

const reviewSchema = z.strictObject({
  id: prototypeIdSchema,
  initials: prototypeTextSchema(8),
  name: prototypeTextSchema(100),
  role: supportingTextSchema(100),
  quote: prototypeTextSchema(600),
  rating: z.number().min(0).max(5).optional(),
  sourceUrl: optionalWebUrlSchema.optional(),
  demonstrative: z.boolean().optional(),
});

const hamburgueriaContentSchema = z.strictObject({
  header: z.strictObject({
    navigation: z
      .array(
        z.strictObject({
          target: z.enum(sectionIds),
          label: prototypeTextSchema(50),
        }),
      )
      .max(12),
    menuButtonLabel: prototypeTextSchema(60),
  }),
  hero: z.strictObject({
    eyebrow: supportingTextSchema(120),
    headline: z.tuple([prototypeTextSchema(60), supportingTextSchema(60)]),
    description: z.tuple([
      supportingTextSchema(180),
      supportingTextSchema(180),
    ]),
    image: templateImageSchema,
    primaryCtaLabel: prototypeTextSchema(60),
    secondaryCtaLabel: prototypeTextSchema(60),
    reviewStarsLabel: prototypeTextSchema(40),
    reviewCountLabel: supportingTextSchema(60),
    hoursSummary: supportingTextSchema(100),
    serviceSummary: supportingTextSchema(100),
    badgeText: supportingTextSchema(60),
    badgeLines: z.tuple([supportingTextSchema(40), supportingTextSchema(40)]),
    bottomNote: supportingTextSchema(120),
  }),
  qualities: z.strictObject({
    accessibleLabel: prototypeTextSchema(120),
    items: z
      .array(
        z.strictObject({
          id: prototypeIdSchema,
          icon: iconKeySchema,
          title: prototypeTextSchema(80),
          description: supportingTextSchema(180),
        }),
      )
      .min(1)
      .max(8),
  }),
  menu: z.strictObject({
    eyebrow: supportingTextSchema(120),
    title: prototypeTextSchema(100),
    helpLinkLabel: prototypeTextSchema(100),
    note: supportingTextSchema(120),
    categoryGroupLabel: prototypeTextSchema(100),
    defaultCategoryId: prototypeIdSchema.nullable(),
    categories: z
      .array(categorySchema)
      .max(HAMBURGUERIA_MENU_LIMITS.categories),
    products: z.array(menuProductSchema).max(HAMBURGUERIA_MENU_LIMITS.products),
    extrasHeading: supportingTextSchema(120),
    extras: z
      .array(
        z.strictObject({
          id: prototypeIdSchema,
          name: prototypeTextSchema(100),
          priceCents: z
            .number()
            .int()
            .nonnegative()
            .max(HAMBURGUERIA_MENU_LIMITS.priceCents),
        }),
      )
      .max(HAMBURGUERIA_MENU_LIMITS.extras),
    vegetarianNote: supportingTextSchema(180),
    vegetarianLabel: prototypeTextSchema(60),
    customizationNote: supportingTextSchema(180),
    orderButtonLabel: prototypeTextSchema(40),
  }),
  service: z.strictObject({
    modes: z.strictObject({
      delivery: z.boolean(),
      pickup: z.boolean(),
      dineIn: z.boolean(),
    }),
    openingHours: z.array(prototypeTextSchema(160)).min(1).max(14),
    orderingHoursNote: supportingTextSchema(180),
    delivery: z.strictObject({
      areas: z
        .array(
          z.strictObject({
            id: prototypeIdSchema,
            name: prototypeTextSchema(100),
            feeCents: z.number().int().nonnegative().max(100_000_000),
          }),
        )
        .min(1)
        .max(100),
      neighborhoodsSummary: supportingTextSchema(240),
      priceRangeText: supportingTextSchema(120),
      minimumFeeCents: z.number().int().nonnegative().max(100_000_000),
      estimate: prototypeTextSchema(60),
      pickupEstimate: prototypeTextSchema(60),
    }),
    paymentMethodsText: supportingTextSchema(160),
    pickupFeeText: supportingTextSchema(80),
  }),
  story: z.strictObject({
    featured: z.strictObject({
      productId: prototypeIdSchema.nullable(),
      image: templateImageSchema,
      eyebrow: supportingTextSchema(120),
      headline: z.tuple([
        prototypeTextSchema(40),
        supportingTextSchema(40),
        supportingTextSchema(40),
      ]),
      description: z.tuple([
        supportingTextSchema(160),
        supportingTextSchema(160),
      ]),
      priceLabel: supportingTextSchema(60),
      ctaLabel: prototypeTextSchema(60),
      targetCategoryId: prototypeIdSchema.nullable(),
    }),
    eyebrow: supportingTextSchema(120),
    headline: z.tuple([
      prototypeTextSchema(60),
      supportingTextSchema(60),
      supportingTextSchema(60),
    ]),
    paragraphs: z.array(supportingTextSchema(1000)).min(1).max(8),
    signature: z.tuple([supportingTextSchema(120), supportingTextSchema(120)]),
  }),
  howToOrder: z.strictObject({
    eyebrow: supportingTextSchema(120),
    title: prototypeTextSchema(120),
    steps: z.tuple([
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: supportingTextSchema(300),
      }),
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: supportingTextSchema(300),
      }),
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: supportingTextSchema(300),
      }),
    ]),
    minimumDeliveryLabel: prototypeTextSchema(100),
    atendimentoLinkLabel: prototypeTextSchema(100),
  }),
  reviews: z.strictObject({
    eyebrow: supportingTextSchema(120),
    title: prototypeTextSchema(120),
    rating: z.number().min(0).max(5),
    count: z.number().int().nonnegative().max(100_000_000),
    ratingSource: z.enum(["demo", "lead", "provided"]).optional(),
    countSource: z.enum(["demo", "lead", "provided"]).optional(),
    starsLabel: prototypeTextSchema(40),
    countLabel: supportingTextSchema(80),
    entries: z.array(reviewSchema).max(30),
  }),
  location: z.strictObject({
    eyebrow: supportingTextSchema(120),
    headline: z.tuple([prototypeTextSchema(80), supportingTextSchema(80)]),
    description: supportingTextSchema(500),
    addressHeading: prototypeTextSchema(80),
    hoursHeading: prototypeTextSchema(80),
    deliveryHeading: prototypeTextSchema(80),
    image: templateImageSchema,
    mapRoad: supportingTextSchema(120),
    mapAvenue: supportingTextSchema(120),
    mapPlaceTagline: supportingTextSchema(120),
    mapAccessibleLabel: prototypeTextSchema(160),
    mapLinkLabel: prototypeTextSchema(80),
    mapCaption: supportingTextSchema(100),
    orderLinkLabel: prototypeTextSchema(80),
    socialLinkPrefix: supportingTextSchema(40),
  }),
  faq: z.strictObject({
    eyebrow: supportingTextSchema(120),
    headline: z.tuple([prototypeTextSchema(60), supportingTextSchema(60)]),
    intro: z.tuple([supportingTextSchema(120), supportingTextSchema(120)]),
    items: z
      .array(
        z.strictObject({
          id: prototypeIdSchema,
          question: prototypeTextSchema(200),
          answer: prototypeTextSchema(1200),
          demoOnly: z.boolean().optional(),
        }),
      )
      .max(40),
  }),
  finalCallToAction: z.strictObject({
    eyebrow: supportingTextSchema(120),
    title: prototypeTextSchema(120),
    buttonLabel: prototypeTextSchema(60),
  }),
  footer: z.strictObject({
    navigationHeading: supportingTextSchema(80),
    navigationLinks: z.tuple([
      z.strictObject({
        target: z.enum(sectionIds),
        label: prototypeTextSchema(80),
      }),
      z.strictObject({
        target: z.enum(sectionIds),
        label: prototypeTextSchema(80),
      }),
      z.strictObject({
        target: z.enum(sectionIds),
        label: prototypeTextSchema(80),
      }),
    ]),
    serviceHeading: supportingTextSchema(80),
    faqLinkLabel: prototypeTextSchema(80),
    serviceLines: z.tuple([
      supportingTextSchema(120),
      supportingTextSchema(120),
    ]),
    signature: z.tuple([supportingTextSchema(120), supportingTextSchema(120)]),
    buttonLabel: prototypeTextSchema(80),
    copyrightYear: z.number().int().min(2000).max(2200),
  }),
  demoCopy: z.strictObject({
    orderDialogTitle: prototypeTextSchema(120),
    orderDialogMessage: prototypeTextSchema(500),
    socialDialogTitle: prototypeTextSchema(120),
    socialDialogMessage: prototypeTextSchema(500),
    reviewDisclaimer: prototypeTextSchema(300),
    locationDisclaimer: prototypeTextSchema(200),
    contactDisclaimer: prototypeTextSchema(160),
    footerDisclaimer: prototypeTextSchema(300),
  }),
  interactions: z.strictObject({
    orderMessage: prototypeTextSchema(500),
    productOrderMessage: prototypeTextSchema(500),
  }),
});

function checkUniqueIds(
  items: ReadonlyArray<{ id: string }>,
  path: (string | number)[],
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "id"],
        message: `O ID "${item.id}" está duplicado nesta lista.`,
      });
    }
    seen.add(item.id);
  });
}

export const hamburgueriaPrototypeDocumentSchema = z
  .strictObject({
    ...prototypeBaseSchema.shape,
    category: z.literal("hamburgueria"),
    confirmedFields: z
      .array(z.enum(HAMBURGUERIA_CONFIRMABLE_FIELDS))
      .max(HAMBURGUERIA_CONFIRMABLE_FIELDS.length)
      .refine(
        (fields) => new Set(fields).size === fields.length,
        "Campos confirmados não podem se repetir.",
      )
      .optional(),
    business: prototypeBaseSchema.shape.business.extend({
      tagline: supportingTextSchema(160),
      brandLines: z.tuple([prototypeTextSchema(40), supportingTextSchema(40)]),
    }),
    template: z.strictObject({
      id: z.literal("brasa-burger"),
      version: z.number().int().positive().max(10_000),
    }),
    appearance: z.strictObject({
      colors: z.strictObject({
        primary: hexColorSchema,
        secondary: hexColorSchema,
        tertiary: hexColorSchema,
      }),
      fonts: z.strictObject({
        body: fontKeySchema,
        display: fontKeySchema,
        hand: fontKeySchema,
      }),
    }),
    sections: hamburgueriaSectionVisibilitySchema,
    content: hamburgueriaContentSchema,
  })
  .superRefine((document, ctx) => {
    const categories = document.content.menu.categories;
    const products = document.content.menu.products;
    const categoryIds = new Set(categories.map((category) => category.id));
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    checkUniqueIds(categories, ["content", "menu", "categories"], ctx);
    checkUniqueIds(products, ["content", "menu", "products"], ctx);
    checkUniqueIds(
      document.content.menu.extras,
      ["content", "menu", "extras"],
      ctx,
    );
    checkUniqueIds(
      document.content.qualities.items,
      ["content", "qualities", "items"],
      ctx,
    );
    checkUniqueIds(
      document.content.service.delivery.areas,
      ["content", "service", "delivery", "areas"],
      ctx,
    );
    checkUniqueIds(
      document.content.reviews.entries,
      ["content", "reviews", "entries"],
      ctx,
    );
    checkUniqueIds(
      document.content.faq.items,
      ["content", "faq", "items"],
      ctx,
    );
    checkUniqueIds(
      document.content.howToOrder.steps,
      ["content", "howToOrder", "steps"],
      ctx,
    );

    const defaultCategoryId = document.content.menu.defaultCategoryId;
    if (
      categories.length
        ? defaultCategoryId === null || !categoryIds.has(defaultCategoryId)
        : defaultCategoryId !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "menu", "defaultCategoryId"],
        message: "A categoria inicial precisa existir no cardápio.",
      });
    }

    products.forEach((product, index) => {
      if (!categoryIds.has(product.categoryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "menu", "products", index, "categoryId"],
          message: `A categoria "${product.categoryId}" não existe.`,
        });
      }
    });

    const featured = document.content.story.featured;
    const featuredProduct =
      featured.productId === null
        ? undefined
        : productById.get(featured.productId);
    if (featured.productId !== null && !featuredProduct) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "story", "featured", "productId"],
        message: "O produto em destaque precisa existir no cardápio.",
      });
    } else if (
      featuredProduct &&
      featuredProduct.categoryId !== featured.targetCategoryId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "story", "featured", "targetCategoryId"],
        message:
          "A categoria de destino deve corresponder ao produto em destaque.",
      });
    }

    if (
      featured.productId === null
        ? featured.targetCategoryId !== null
        : featured.targetCategoryId === null ||
          !categoryIds.has(featured.targetCategoryId)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "story", "featured", "targetCategoryId"],
        message: "A categoria do destaque precisa existir no cardápio.",
      });
    }

    const images = [
      document.seo.socialImage,
      document.content.hero.image,
      ...products.map((product) => product.image),
      document.content.story.featured.image,
      document.content.location.image,
    ];
    const supportedAssets = new Set<string>(HAMBURGUERIA_TEMPLATE_ASSETS);
    images.forEach((image, index) => {
      if (image?.source === "template" && !supportedAssets.has(image.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "images", index, "key"],
          message: `O asset de template "${image.key}" não é suportado.`,
        });
      }
    });

    if (!document.demo.enabled && !document.contact.whatsapp) {
      ctx.addIssue({
        code: "custom",
        path: ["contact", "whatsapp"],
        message:
          "Informe um WhatsApp para documentos publicados fora do modo demonstração.",
      });
    }
  });

export type HamburgueriaPrototypeDocument = z.infer<
  typeof hamburgueriaPrototypeDocumentSchema
>;
export type HamburgueriaSectionId = keyof z.infer<
  typeof hamburgueriaSectionVisibilitySchema
>;
