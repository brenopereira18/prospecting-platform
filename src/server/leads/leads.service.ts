import { LeadSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { PreliminaryScoreService } from "../scoring/preliminary-score.service";
import { LeadFiltersDTO, LeadListItemDTO } from "./lead.dto";

interface CreateGoogleLeadInput {
  userId: string;
  categoryId: string;
  placeId: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
}

const preliminaryScoreService = new PreliminaryScoreService();

export class LeadService {
  async createFromGoogle(input: CreateGoogleLeadInput) {
    const score = preliminaryScoreService.calculate({
      website: input.website,
      phone: input.phone,
      rating: input.rating,
      userRatingCount: input.userRatingCount,
    });

    return prisma.lead.create({
      data: {
        userId: input.userId,
        source: LeadSource.GOOGLE_PLACES,
        sourceId: input.placeId,
        categoryId: input.categoryId,
        name: input.name,
        address: input.address,
        website: input.website,
        phone: input.phone,
        rating: input.rating,
        userRatingCount: input.userRatingCount,
        score,
      },
    });
  }

  async listByUser(
    userId: string,
    filters: LeadFiltersDTO = {},
  ): Promise<LeadListItemDTO[]> {
    const leads = await prisma.lead.findMany({
      where: {
        userId,

        ...(filters.name && {
          name: {
            contains: filters.name,
            mode: "insensitive",
          },
        }),

        ...(filters.categoryId && {
          categoryId: filters.categoryId,
        }),

        ...(filters.status && {
          status: filters.status,
        }),
      },

      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        website: true,
        rating: true,
        userRatingCount: true,
        score: true,
        status: true,

        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return leads;
  }

  async findRegisteredGooglePlaceIds(
    userId: string,
    placeIds: string[],
  ): Promise<Set<string>> {
    if (placeIds.length === 0) {
      return new Set();
    }

    const leads = await prisma.lead.findMany({
      where: {
        userId,
        source: LeadSource.GOOGLE_PLACES,
        sourceId: {
          in: placeIds,
        },
      },
      select: {
        sourceId: true,
      },
    });

    return new Set(
      leads
        .map((lead) => lead.sourceId)
        .filter((sourceId): sourceId is string => sourceId !== null),
    );
  }
}
