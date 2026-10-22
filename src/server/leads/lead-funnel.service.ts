import type { LeadStatus } from "../../../generated/prisma/enums";
import type { PrismaClient } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma/client";
import type { LeadCommercialFunnelDTO } from "./lead.dto";

export class LeadFunnelService {
  constructor(private readonly db: Pick<PrismaClient, "lead"> = prisma) {}

  async getByUser(userId: string): Promise<LeadCommercialFunnelDTO> {
    if (!userId.trim()) throw new Error("Usuário não autenticado.");

    const groups = await this.db.lead.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });
    const counts: Record<LeadStatus, number> = {
      NOVO: 0,
      PROPOSTA_ENVIADA: 0,
      GANHO: 0,
      PERDIDO: 0,
    };
    let total = 0;
    for (const group of groups) {
      counts[group.status] = group._count._all;
      total += group._count._all;
    }

    return {
      total,
      counts,
      conversionRate: total > 0 ? (counts.GANHO / total) * 100 : 0,
    };
  }
}
