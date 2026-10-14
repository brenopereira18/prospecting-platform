import { prisma } from "@/lib/prisma/client";

import type {
  CreateLeadInteractionDTO,
  LeadInteractionDTO,
} from "./lead-interaction.dto";

export class LeadInteractionService {
  async findByLead(
    leadId: string,
    userId: string,
  ): Promise<LeadInteractionDTO[]> {
    return prisma.leadInteraction.findMany({
      where: {
        leadId,
        lead: {
          userId,
        },
      },
      select: {
        id: true,
        leadId: true,
        channel: true,
        type: true,
        notes: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async create(
    data: CreateLeadInteractionDTO,
    userId: string,
  ): Promise<LeadInteractionDTO> {
    const lead = await prisma.lead.findFirst({
      where: {
        id: data.leadId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      throw new Error("Lead não encontrado.");
    }

    return prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        channel: data.channel,
        type: data.type,
        notes: data.notes?.trim() || null,
      },
      select: {
        id: true,
        leadId: true,
        channel: true,
        type: true,
        notes: true,
        createdAt: true,
      },
    });
  }
}

export const leadInteractionService = new LeadInteractionService();
