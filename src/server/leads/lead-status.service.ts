import type { PrismaClient } from "../../../generated/prisma/client";
import { z } from "zod";
import {
  changeLeadStatusSchema,
  type LeadStatusChangeResult,
  type LeadStatusHistoryDTO,
} from "./lead-status.schema";

export class LeadStatusError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

export class LeadStatusService {
  constructor(private readonly db: PrismaClient) {}

  private requireUser(userId: string) {
    if (!userId.trim())
      throw new LeadStatusError(
        "UNAUTHENTICATED",
        "Sua sessão expirou. Faça login novamente.",
      );
  }

  async change(
    input: unknown,
    userId: string,
  ): Promise<LeadStatusChangeResult> {
    this.requireUser(userId);
    const data = changeLeadStatusSchema.parse(input);
    return this.db.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: data.leadId, userId },
        select: { id: true, status: true, statusRevision: true },
      });
      if (!lead) throw new LeadStatusError("NOT_FOUND", "Lead não encontrado.");
      const conflict = () =>
        new LeadStatusError(
          "CONFLICT",
          "O status foi alterado em outra aba. Atualize o status antes de tentar novamente.",
        );
      if (lead.statusRevision !== data.expectedRevision) throw conflict();
      if (lead.status === data.status)
        return {
          changed: false,
          status: lead.status,
          statusRevision: lead.statusRevision,
        };

      // PostgreSQL serializes concurrent updates on this row. After waiting,
      // the revision predicate is checked again; a stale write affects no rows.
      const updated = await tx.lead.updateMany({
        where: {
          id: lead.id,
          userId,
          status: lead.status,
          statusRevision: data.expectedRevision,
        },
        data: { status: data.status, statusRevision: { increment: 1 } },
      });
      if (updated.count !== 1) throw conflict();

      const occurredAt = new Date();
      const revision = lead.statusRevision + 1;
      await tx.leadStatusHistory.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: data.status,
          revision,
          occurredAt,
          recordedAt: occurredAt,
        },
      });
      return { changed: true, status: data.status, statusRevision: revision };
    });
  }

  async history(
    leadId: string,
    userId: string,
  ): Promise<LeadStatusHistoryDTO[]> {
    this.requireUser(userId);
    z.uuid().parse(leadId);
    if (
      !(await this.db.lead.findFirst({
        where: { id: leadId, userId },
        select: { id: true },
      }))
    )
      throw new LeadStatusError("NOT_FOUND", "Lead não encontrado.");
    const rows = await this.db.leadStatusHistory.findMany({
      where: { leadId, lead: { userId } },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        revision: true,
        occurredAt: true,
        recordedAt: true,
      },
      orderBy: [{ occurredAt: "desc" }, { revision: "desc" }],
    });
    return rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      recordedAt: row.recordedAt.toISOString(),
    }));
  }
}
