import { z } from "zod";

export const prototypeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/);

export const prototypeTextSchema = (max: number) =>
  z.string().trim().min(1).max(max);

export const hexColorSchema = z
  .string()
  .regex(
    /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/,
    "Informe uma cor hexadecimal válida.",
  );

export const fontKeySchema = z.enum(["barlow", "barlow-condensed", "caveat"]);

export const imageFocalPointSchema = z.strictObject({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const imageFramingSchema = z.strictObject({
  zoom: z.number().finite().min(1).max(3),
  positionX: z.number().finite().min(0).max(100),
  positionY: z.number().finite().min(0).max(100),
});
export type ImageFraming = z.infer<typeof imageFramingSchema>;

const imageReferenceFields = {
  alt: prototypeTextSchema(300),
  focalPoint: imageFocalPointSchema.optional(),
  framing: imageFramingSchema.optional(),
};

export const imageReferenceSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("template"),
    key: prototypeIdSchema,
    ...imageReferenceFields,
  }),
  z.strictObject({
    source: z.literal("upload"),
    assetId: prototypeIdSchema,
    ...imageReferenceFields,
  }),
]);

export const optionalWebUrlSchema = z.union([
  z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Utilize um link HTTP ou HTTPS.",
    ),
  z.literal(""),
]);

const phoneSchema = z
  .string()
  .trim()
  .max(24)
  .refine((value) => {
    if (value === "") return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Informe um telefone com DDI e DDD válidos.");

export const prototypeBaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  template: z.strictObject({
    id: prototypeIdSchema,
    version: z.number().int().positive().max(10_000),
  }),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  business: z.strictObject({
    name: prototypeTextSchema(120),
    tagline: prototypeTextSchema(160),
    brandLines: z.tuple([prototypeTextSchema(40), prototypeTextSchema(40)]),
    foundedYear: z.number().int().min(1800).max(2200).optional(),
    address: z.strictObject({
      street: prototypeTextSchema(160),
      neighborhood: prototypeTextSchema(100),
      city: prototypeTextSchema(100),
      state: z.string().trim().min(2).max(50),
      postalCode: z.string().trim().max(20).optional(),
    }),
  }),
  seo: z.strictObject({
    title: prototypeTextSchema(160),
    description: prototypeTextSchema(320),
    canonicalUrl: optionalWebUrlSchema.optional(),
    socialImage: imageReferenceSchema.optional(),
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
  contact: z.strictObject({
    phone: phoneSchema.optional(),
    whatsapp: phoneSchema.optional(),
    instagramUrl: optionalWebUrlSchema.optional(),
    instagramLabel: z.string().trim().max(80).optional(),
    mapsUrl: optionalWebUrlSchema.optional(),
  }),
  demo: z.strictObject({
    enabled: z.boolean(),
  }),
  sections: z
    .record(prototypeIdSchema, z.boolean())
    .superRefine((sections, ctx) => {
      const count = Object.keys(sections).length;
      if (count < 1 || count > 30) {
        ctx.addIssue({
          code: "custom",
          message:
            "O documento deve conter entre 1 e 30 configurações de seção.",
        });
      }
    }),
});

export type ImageReference = z.infer<typeof imageReferenceSchema>;
