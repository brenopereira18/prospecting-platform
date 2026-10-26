import { reviseProposalCopy } from "./proposal-copy";
import { z } from "zod";
import {
  Prisma,
  type PrismaClient,
  type CommercialProposal,
} from "../../../generated/prisma/client";
import {
  createProposalSchema,
  updateProposalSchema,
  statusProposalSchema,
  duplicateProposalSchema,
  proposalCommandSchema,
  proposalContentSchema,
  nextStatuses,
  type ProposalContent,
  type ProposalDTO,
} from "./proposal.schema";

export class ProposalError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "LOCKED"
      | "INVALID_STATUS",
    message: string,
  ) {
    super(message);
  }
}
function dto(row: CommercialProposal): ProposalDTO {
  const { userId: _owner, ...rest } = row;
  void _owner;
  return {
    ...rest,
    total: row.total.toFixed(2),
    deposit: row.deposit?.toFixed(2) ?? null,
    monthlyAmount: row.monthlyAmount?.toFixed(2) ?? null,
    validUntil: row.validUntil.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lockedAt: row.lockedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
function contentData(input: ProposalContent) {
  const content = reviseProposalCopy(input);
  return {
    ...content,
    total: new Prisma.Decimal(content.total),
    deposit:
      content.deposit === null ? null : new Prisma.Decimal(content.deposit),
    monthlyAmount:
      content.monthlyAmount === null
        ? null
        : new Prisma.Decimal(content.monthlyAmount),
    validUntil: new Date(`${content.validUntil}T00:00:00Z`),
  };
}
export class ProposalService {
  constructor(private readonly db: PrismaClient) {}
  private user(userId: string) {
    if (!userId.trim())
      throw new ProposalError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Faça login novamente.",
      );
  }
  private async lead(
    db: Prisma.TransactionClient,
    leadId: string,
    userId: string,
  ) {
    const lead = await db.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) throw new ProposalError("NOT_FOUND", "Lead não encontrado.");
    return lead;
  }
  private async owned(
    db: Prisma.TransactionClient,
    id: string,
    leadId: string,
    userId: string,
  ) {
    const row = await db.commercialProposal.findFirst({
      where: { id, leadId, userId, lead: { userId } },
    });
    if (!row) throw new ProposalError("NOT_FOUND", "Proposta não encontrada.");
    return row;
  }
  async list(leadId: string, userId: string) {
    this.user(userId);
    z.uuid().parse(leadId);
    await this.lead(this.db, leadId, userId);
    const rows = await this.db.commercialProposal.findMany({
      where: { leadId, userId, deletedAt: null, lead: { userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(dto);
  }
  async get(id: string, leadId: string, userId: string) {
    this.user(userId);
    z.uuid().parse(id);
    z.uuid().parse(leadId);
    return dto(await this.owned(this.db, id, leadId, userId));
  }
  async history(id: string, leadId: string, userId: string) {
    await this.get(id, leadId, userId);
    return this.db.proposalStatusHistory.findMany({
      where: { proposalId: id, proposal: { userId, leadId, lead: { userId } } },
      orderBy: { revision: "desc" },
    });
  }
  async create(input: unknown, userId: string) {
    this.user(userId);
    const data = createProposalSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "leads" WHERE "id" = ${data.leadId} AND "userId" = ${userId} FOR UPDATE`,
      );
      const lead = await this.lead(tx, data.leadId, userId);
      const existing = await tx.commercialProposal.findUnique({
        where: { id: data.id },
      });
      if (existing) {
        if (existing.userId !== userId || existing.leadId !== data.leadId)
          throw new ProposalError(
            "CONFLICT",
            "Identificador já utilizado. Reabra o formulário.",
          );
        const saved = dto(existing);
        const sameContent = Object.entries(
          reviseProposalCopy(data.content),
        ).every(
          ([key, value]) => saved[key as keyof ProposalContent] === value,
        );
        if (!sameContent || saved.deletedAt)
          throw new ProposalError(
            "CONFLICT",
            "Esta proposta já foi criada com outros dados. Abra a proposta salva na página do lead antes de continuar.",
          );
        return saved;
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return dto(
        await tx.commercialProposal.create({
          data: {
            ...contentData(data.content),
            id: data.id,
            userId,
            leadId: lead.id,
            clientName: lead.name,
            clientAddress: lead.address,
            clientPhone: lead.phone,
            issuerName: user.name,
            issuerEmail: user.email,
          },
        }),
      );
    });
  }
  private async lock(
    tx: Prisma.TransactionClient,
    data: z.infer<typeof proposalCommandSchema>,
    userId: string,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "commercial_proposals" WHERE "id" = ${data.id} AND "userId" = ${userId} FOR UPDATE`,
    );
    const row = await this.owned(tx, data.id, data.leadId, userId);
    if (row.deletedAt || row.revision !== data.expectedRevision)
      throw new ProposalError(
        "CONFLICT",
        "A proposta mudou em outra aba ou foi excluída. Recarregue antes de continuar.",
      );
    return row;
  }
  async update(input: unknown, userId: string) {
    this.user(userId);
    const data = updateProposalSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data, userId);
      if (row.lockedAt || row.status !== "RASCUNHO")
        throw new ProposalError(
          "LOCKED",
          "O conteúdo desta proposta está preservado. Duplique para preparar uma revisão.",
        );
      return dto(
        await tx.commercialProposal.update({
          where: { id: row.id },
          data: { ...contentData(data.content), revision: { increment: 1 } },
        }),
      );
    });
  }
  async changeStatus(input: unknown, userId: string) {
    this.user(userId);
    const data = statusProposalSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data, userId);
      if (row.status === data.status) return dto(row);
      if (!nextStatuses[row.status].includes(data.status))
        throw new ProposalError(
          "INVALID_STATUS",
          "Esta mudança de status não é permitida. Duplique a proposta para uma nova negociação.",
        );
      const updated = await tx.commercialProposal.update({
        where: { id: row.id },
        data: {
          ...(row.status === "RASCUNHO" && !row.lockedAt
            ? contentData(
                proposalContentSchema.parse(
                  Object.fromEntries(
                    Object.keys(proposalContentSchema.shape).map((key) => [
                      key,
                      dto(row)[key as keyof ProposalDTO],
                    ]),
                  ),
                ),
              )
            : {}),
          status: data.status,
          lockedAt: row.lockedAt ?? new Date(),
          revision: { increment: 1 },
        },
      });
      await tx.proposalStatusHistory.create({
        data: {
          proposalId: row.id,
          fromStatus: row.status,
          toStatus: data.status,
          revision: updated.revision,
        },
      });
      return dto(updated);
    });
  }
  async duplicate(input: unknown, userId: string) {
    this.user(userId);
    const data = duplicateProposalSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data, userId);
      const existing = await tx.commercialProposal.findUnique({
        where: { id: data.newId },
      });
      if (existing) {
        if (existing.userId !== userId || existing.sourceProposalId !== row.id)
          throw new ProposalError("CONFLICT", "Identificador já utilizado.");
        return dto(existing);
      }
      const original = dto(row);
      const content = proposalContentSchema.parse(
        Object.fromEntries(
          Object.keys(proposalContentSchema.shape).map((key) => [
            key,
            original[key as keyof ProposalDTO],
          ]),
        ),
      );
      return dto(
        await tx.commercialProposal.create({
          data: {
            ...contentData(content),
            id: data.newId,
            userId,
            leadId: row.leadId,
            sourceProposalId: row.id,
            clientName: row.clientName,
            clientPhone: row.clientPhone,
            clientAddress: row.clientAddress,
            issuerName: row.issuerName,
            issuerEmail: row.issuerEmail,
          },
        }),
      );
    });
  }
  async delete(input: unknown, userId: string) {
    this.user(userId);
    const data = proposalCommandSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, data, userId);
      return dto(
        await tx.commercialProposal.update({
          where: { id: row.id },
          data: { deletedAt: new Date(), revision: { increment: 1 } },
        }),
      );
    });
  }
}
