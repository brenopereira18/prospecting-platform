import { z } from "zod";
import { persistablePrototypeDocumentSchema, containsTemporaryOrDataUrl } from "../../components/prototypes/schemas/persistable-document.schema";

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
