import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import type { PrismaClient, Prisma, Prototype, PrototypeVersion } from "../../../generated/prisma/client";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";
import { createPrototypeSchema, updatePrototypeDraftSchema, createPrototypeVersionSchema } from "./prototype.schema";
import type { PrototypeDTO, PrototypeSummaryDTO, PrototypeVersionDTO, PrototypeVersionSummaryDTO } from "./prototype.dto";

export class PrototypeError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT", message: string) { super(message); }
}
const summarySelect = { id: true, name: true, templateId: true, templateVersion: true, draftRevision: true, leadId: true, createdAt: true, updatedAt: true } satisfies Prisma.PrototypeSelect;
function summary(row: Pick<Prototype, keyof typeof summarySelect>): PrototypeSummaryDTO {
  return { id: row.id, name: row.name, templateId: row.templateId, templateVersion: row.templateVersion,
    draftRevision: row.draftRevision, leadId: row.leadId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function dto(row: Prototype): PrototypeDTO {
  return { ...summary(row), draftDocument: persistablePrototypeDocumentSchema.parse(row.draftDocument) };
}
function versionSummary(row: Pick<PrototypeVersion, "id" | "prototypeId" | "number" | "createdAt">): PrototypeVersionSummaryDTO {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
function versionDTO(row: PrototypeVersion): PrototypeVersionDTO {
  return { ...versionSummary(row), document: persistablePrototypeDocumentSchema.parse(row.document) };
}
function json(document: unknown): Prisma.InputJsonObject { return JSON.parse(JSON.stringify(document)) as Prisma.InputJsonObject; }

export class PrototypeService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(input: unknown, userId: string): Promise<PrototypeDTO> {
    const data = createPrototypeSchema.parse(input);
    return this.db.$transaction(async tx => {
      if (data.leadId && !await tx.lead.findFirst({ where: { id: data.leadId, userId }, select: { id: true } }))
        throw new PrototypeError("NOT_FOUND", "Lead não encontrado.");
      return dto(await tx.prototype.create({ data: { userId, name: data.name, leadId: data.leadId,
        templateId: data.document.template.id, templateVersion: data.document.template.version, draftDocument: json(data.document) } }));
    });
  }

  async findById(id: string, userId: string): Promise<PrototypeDTO> {
    z.uuid().parse(id);
    const row = await this.db.prototype.findFirst({ where: { id, userId } });
    if (!row) throw new PrototypeError("NOT_FOUND", "Protótipo não encontrado.");
    return dto(row);
  }

  async list(userId: string): Promise<PrototypeSummaryDTO[]> {
    const rows = await this.db.prototype.findMany({ where: { userId }, select: summarySelect, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
    return rows.map(summary);
  }

  private async failedRevision(tx: Prisma.TransactionClient, id: string, userId: string): Promise<never> {
    const owned = await tx.prototype.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) throw new PrototypeError("NOT_FOUND", "Protótipo não encontrado.");
    throw new PrototypeError("CONFLICT", "Existe uma revisão mais recente deste protótipo. Suas alterações locais foram mantidas. Abra o rascunho salvo em outra aba para comparar.");
  }

  async updateDraft(input: unknown, userId: string): Promise<PrototypeDTO> {
    const data = updatePrototypeDraftSchema.parse(input);
    return this.db.$transaction(async tx => {
      const result = await tx.prototype.updateMany({ where: { id: data.id, userId, draftRevision: data.expectedRevision },
        data: { name: data.name, draftDocument: json(data.document), templateId: data.document.template.id,
          templateVersion: data.document.template.version, draftRevision: { increment: 1 } } });
      if (result.count !== 1) return this.failedRevision(tx, data.id, userId);
      const row = await tx.prototype.findFirstOrThrow({ where: { id: data.id, userId } });
      return dto(row);
    });
  }

  async createVersion(input: unknown, userId: string): Promise<PrototypeVersionDTO> {
    const data = createPrototypeVersionSchema.parse(input);
    return this.db.$transaction(async tx => {
      // This atomic update locks the prototype row until commit. Concurrent requests
      // serialize here and receive different numbers; rollback also rolls back the counter.
      const result = await tx.prototype.updateMany({ where: { id: data.id, userId, draftRevision: data.expectedRevision },
        data: { versionSequence: { increment: 1 } } });
      if (result.count !== 1) return this.failedRevision(tx, data.id, userId);
      const row = await tx.prototype.findFirstOrThrow({ where: { id: data.id, userId } });
      const document = persistablePrototypeDocumentSchema.parse(row.draftDocument);
      return versionDTO(await tx.prototypeVersion.create({ data: { prototypeId: row.id, number: row.versionSequence, document: json(document) } }));
    });
  }

  async listVersions(id: string, userId: string): Promise<PrototypeVersionSummaryDTO[]> {
    z.uuid().parse(id);
    if (!await this.db.prototype.findFirst({ where: { id, userId }, select: { id: true } })) throw new PrototypeError("NOT_FOUND", "Protótipo não encontrado.");
    return (await this.db.prototypeVersion.findMany({ where: { prototypeId: id, prototype: { userId } },
      select: { id: true, prototypeId: true, number: true, createdAt: true }, orderBy: { number: "desc" } })).map(versionSummary);
  }

  async findVersion(id: string, versionId: string, userId: string): Promise<PrototypeVersionDTO> {
    z.uuid().parse(id); z.uuid().parse(versionId);
    const row = await this.db.prototypeVersion.findFirst({ where: { id: versionId, prototypeId: id, prototype: { userId } } });
    if (!row) throw new PrototypeError("NOT_FOUND", "Versão não encontrada.");
    return versionDTO(row);
  }
}

export const prototypeService = new PrototypeService();
