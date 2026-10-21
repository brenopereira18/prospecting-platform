import { z } from "zod";
import { persistablePrototypeDocumentSchema, containsTemporaryOrDataUrl } from "../../components/prototypes/schemas/persistable-document.schema";
import { prototypeConfigurationSchema } from "../../components/prototypes/schemas/prototype-configuration.schema";

const nameSchema = z.string().trim().min(1).max(120).refine(value => !containsTemporaryOrDataUrl(value), "Use um nome interno, sem URLs temporárias ou dados de imagem.");

export const createPrototypeSchema = z.strictObject({
  name: nameSchema,
  document: persistablePrototypeDocumentSchema,
  leadId: z.uuid().nullable().optional(),
});
export const updatePrototypeDraftSchema = z.strictObject({
  id: z.uuid(), expectedRevision: z.number().int().nonnegative().max(2_147_483_647),
  name: nameSchema, document: persistablePrototypeDocumentSchema,
});
export const createPrototypeVersionSchema = z.strictObject({
  id: z.uuid(), expectedRevision: z.number().int().nonnegative().max(2_147_483_647),
});
export const deletePrototypeSchema = z.strictObject({
  id: z.uuid(), expectedRevision: z.number().int().nonnegative().max(2_147_483_647),
});
export const deletePrototypeVersionSchema = z.strictObject({
  id: z.uuid(), versionId: z.uuid(), confirmed: z.literal(true),
});
export const restorePrototypeVersionSchema = deletePrototypeVersionSchema.extend({
  expectedRevision: z.number().int().nonnegative().max(2_147_483_647),
});
export const createLeadPrototypeSchema = z.strictObject({
  leadId: z.uuid(),
  templateId: z.string().trim().min(1).max(64),
  name: nameSchema,
  expectedPrototypeCount: z.number().int().nonnegative().max(100_000),
  createAnother: z.boolean().default(false),
  configuration: prototypeConfigurationSchema,
});
