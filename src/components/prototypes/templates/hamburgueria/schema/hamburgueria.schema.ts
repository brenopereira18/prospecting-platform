import { z } from "zod";

import {
  fontKeySchema,
  hexColorSchema,
  imageReferenceSchema,
  prototypeBaseSchema,
  prototypeIdSchema,
  prototypeTextSchema,
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

const iconKeySchema = z.enum(HAMBURGUERIA_ICON_KEYS);
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
    description: prototypeTextSchema(600),
    priceCents: z.number().int().nonnegative().max(100_000_000),
    image: templateImageSchema.optional(),
    icon: iconKeySchema.optional(),
    badge: prototypeTextSchema(60).optional(),
    vegetarian: z.boolean().optional(),
    allergens: prototypeTextSchema(300).optional(),
  })
  .refine((product) => Boolean(product.image || product.icon), {
    path: ["image"],
    message: "O produto precisa de uma imagem ou ícone.",
  });

const reviewSchema = z.strictObject({
  id: prototypeIdSchema,
  initials: prototypeTextSchema(8),
  name: prototypeTextSchema(100),
  role: prototypeTextSchema(100),
  quote: prototypeTextSchema(600),
  rating: z.number().min(0).max(5).optional(),
  sourceUrl: z
    .union([z.string().trim().url().max(2048), z.literal("")])
    .optional(),
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
    eyebrow: prototypeTextSchema(120),
    headline: z.tuple([prototypeTextSchema(60), prototypeTextSchema(60)]),
    description: z.tuple([prototypeTextSchema(180), prototypeTextSchema(180)]),
    image: templateImageSchema,
    primaryCtaLabel: prototypeTextSchema(60),
    secondaryCtaLabel: prototypeTextSchema(60),
    reviewStarsLabel: prototypeTextSchema(40),
    reviewCountLabel: prototypeTextSchema(60),
    hoursSummary: prototypeTextSchema(100),
    serviceSummary: prototypeTextSchema(100),
    badgeText: prototypeTextSchema(60),
    badgeLines: z.tuple([prototypeTextSchema(40), prototypeTextSchema(40)]),
    bottomNote: prototypeTextSchema(120),
  }),
  qualities: z.strictObject({
    accessibleLabel: prototypeTextSchema(120),
    items: z
      .array(
        z.strictObject({
          id: prototypeIdSchema,
          icon: iconKeySchema,
          title: prototypeTextSchema(80),
          description: prototypeTextSchema(180),
        }),
      )
      .min(1)
      .max(8),
  }),
  menu: z.strictObject({
    eyebrow: prototypeTextSchema(120),
    title: prototypeTextSchema(100),
    helpLinkLabel: prototypeTextSchema(100),
    note: prototypeTextSchema(120),
    categoryGroupLabel: prototypeTextSchema(100),
    defaultCategoryId: prototypeIdSchema,
    categories: z.array(categorySchema).min(1).max(12),
    products: z.array(menuProductSchema).min(1).max(100),
    extrasHeading: prototypeTextSchema(120),
    extras: z
      .array(
        z.strictObject({
          id: prototypeIdSchema,
          name: prototypeTextSchema(100),
          priceCents: z.number().int().nonnegative().max(100_000_000),
        }),
      )
      .max(40),
    vegetarianNote: prototypeTextSchema(180),
    customizationNote: prototypeTextSchema(180),
    orderButtonLabel: prototypeTextSchema(40),
  }),
  service: z.strictObject({
    modes: z.strictObject({
      delivery: z.boolean(),
      pickup: z.boolean(),
      dineIn: z.boolean(),
    }),
    openingHours: z.array(prototypeTextSchema(160)).min(1).max(14),
    orderingHoursNote: prototypeTextSchema(180),
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
      neighborhoodsSummary: prototypeTextSchema(240),
      priceRangeText: prototypeTextSchema(120),
      minimumFeeCents: z.number().int().nonnegative().max(100_000_000),
      estimate: prototypeTextSchema(60),
      pickupEstimate: prototypeTextSchema(60),
    }),
    paymentMethodsText: prototypeTextSchema(160),
    pickupFeeText: prototypeTextSchema(80),
  }),
  story: z.strictObject({
    featured: z.strictObject({
      productId: prototypeIdSchema,
      image: templateImageSchema,
      imageAlt: prototypeTextSchema(300),
      eyebrow: prototypeTextSchema(120),
      headline: z.tuple([
        prototypeTextSchema(40),
        prototypeTextSchema(40),
        prototypeTextSchema(40),
      ]),
      description: z.tuple([
        prototypeTextSchema(160),
        prototypeTextSchema(160),
      ]),
      priceLabel: prototypeTextSchema(60),
      ctaLabel: prototypeTextSchema(60),
      targetCategoryId: prototypeIdSchema,
    }),
    eyebrow: prototypeTextSchema(120),
    headline: z.tuple([
      prototypeTextSchema(60),
      prototypeTextSchema(60),
      prototypeTextSchema(60),
    ]),
    paragraphs: z.array(prototypeTextSchema(1000)).min(1).max(8),
    signature: z.tuple([prototypeTextSchema(120), prototypeTextSchema(120)]),
  }),
  howToOrder: z.strictObject({
    eyebrow: prototypeTextSchema(120),
    title: prototypeTextSchema(120),
    steps: z.tuple([
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: prototypeTextSchema(300),
      }),
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: prototypeTextSchema(300),
      }),
      z.strictObject({
        id: prototypeIdSchema,
        title: prototypeTextSchema(100),
        body: prototypeTextSchema(300),
      }),
    ]),
    minimumDeliveryLabel: prototypeTextSchema(100),
    atendimentoLinkLabel: prototypeTextSchema(100),
  }),
  reviews: z.strictObject({
    eyebrow: prototypeTextSchema(120),
    title: prototypeTextSchema(120),
    rating: z.number().min(0).max(5),
    count: z.number().int().nonnegative().max(100_000_000),
    starsLabel: prototypeTextSchema(40),
    countLabel: prototypeTextSchema(80),
    entries: z.array(reviewSchema).max(30),
  }),
  location: z.strictObject({
    eyebrow: prototypeTextSchema(120),
    headline: z.tuple([prototypeTextSchema(80), prototypeTextSchema(80)]),
    description: prototypeTextSchema(500),
    addressHeading: prototypeTextSchema(80),
    hoursHeading: prototypeTextSchema(80),
    deliveryHeading: prototypeTextSchema(80),
    image: templateImageSchema,
    mapRoad: prototypeTextSchema(120),
    mapAvenue: prototypeTextSchema(120),
    mapPlaceTagline: prototypeTextSchema(120),
    mapLinkLabel: prototypeTextSchema(80),
    mapCaption: prototypeTextSchema(100),
    orderLinkLabel: prototypeTextSchema(80),
    socialLinkPrefix: prototypeTextSchema(40),
  }),
  faq: z.strictObject({
    eyebrow: prototypeTextSchema(120),
    headline: z.tuple([prototypeTextSchema(60), prototypeTextSchema(60)]),
    intro: z.tuple([prototypeTextSchema(120), prototypeTextSchema(120)]),
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
    eyebrow: prototypeTextSchema(120),
    title: prototypeTextSchema(120),
    buttonLabel: prototypeTextSchema(60),
  }),
  footer: z.strictObject({
    navigationHeading: prototypeTextSchema(80),
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
    serviceHeading: prototypeTextSchema(80),
    faqLinkLabel: prototypeTextSchema(80),
    serviceLines: z.tuple([prototypeTextSchema(120), prototypeTextSchema(120)]),
    signature: z.tuple([prototypeTextSchema(120), prototypeTextSchema(120)]),
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

    if (!categoryIds.has(document.content.menu.defaultCategoryId)) {
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
    const featuredProduct = productById.get(featured.productId);
    if (!featuredProduct) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "story", "featured", "productId"],
        message: "O produto em destaque precisa existir no cardápio.",
      });
    } else if (featuredProduct.categoryId !== featured.targetCategoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "story", "featured", "targetCategoryId"],
        message:
          "A categoria de destino deve corresponder ao produto em destaque.",
      });
    }

    if (!categoryIds.has(featured.targetCategoryId)) {
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
