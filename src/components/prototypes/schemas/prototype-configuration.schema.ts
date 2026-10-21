import { z } from "zod";
import { prototypeBaseSchema } from "./prototype-base.schema";
import { containsTemporaryOrDataUrl } from "./persistable-document.schema";

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !containsTemporaryOrDataUrl(value),
      "Use texto, sem URLs temporárias ou imagens em base64.",
    );
const text = (max: number) => safeText(max).default("");
const contact = prototypeBaseSchema.shape.contact.shape;
const webUrl = (schema: typeof contact.instagramUrl) =>
  schema
    .default("")
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Use um link completo com http:// ou https://.",
    );
const phone = contact.phone
  .default("")
  .refine(
    (value) => !value || /^[+\d\s().-]+$/.test(value),
    "Informe somente o telefone, com DDD ou DDI.",
  );

const headline = text(122)
  .transform((value) => value.replace(/\r\n?/g, "\n"))
  .refine((value) => {
    const lines = value.split(/\r?\n/);
    return (
      !value ||
      (lines.length <= 2 && lines.every((line) => line.trim().length <= 60))
    );
  }, "Use até duas linhas, com no máximo 60 caracteres em cada uma.");

const hamburgueriaConfigurationSchema = z.strictObject({
  modes: z
    .strictObject({
      delivery: z.boolean(),
      pickup: z.boolean(),
      dineIn: z.boolean(),
    })
    .refine(
      (modes) => Object.values(modes).some(Boolean),
      "Selecione ao menos uma modalidade ou mantenha o exemplo do template.",
    )
    .optional(),
  hoursSummary: text(100),
  deliveryRegion: text(240),
});

/** Shared by the configuration form and the application service, without server dependencies. */
export const prototypeConfigurationSchema = z.strictObject({
  businessName: safeText(120).refine(
    (value) => value.length > 0,
    "Informe o nome do estabelecimento.",
  ),
  headline,
  tagline: text(160),
  description: text(320),
  contact: z
    .strictObject({
      phone,
      whatsapp: phone,
      instagramUrl: webUrl(contact.instagramUrl),
      mapsUrl: webUrl(contact.mapsUrl),
    })
    .default({ phone: "", whatsapp: "", instagramUrl: "", mapsUrl: "" }),
  address: z
    .strictObject({
      street: text(160),
      neighborhood: text(100),
      city: text(100),
      state: text(50).refine(
        (value) => !value || value.length >= 2,
        "Informe a UF ou deixe em branco.",
      ),
    })
    .default({ street: "", neighborhood: "", city: "", state: "" }),
  hamburgueria: hamburgueriaConfigurationSchema.optional(),
});

export type PrototypeConfiguration = z.infer<
  typeof prototypeConfigurationSchema
>;
