"use server";

import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";

const leadService = new LeadService();

interface CreateGoogleLeadActionInput {
  categoryId: string;
  placeId: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number;
}

export async function createGoogleLead(input: CreateGoogleLeadActionInput) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  return leadService.createFromGoogle({
    userId: user.id,
    categoryId: input.categoryId,
    placeId: input.placeId,
    name: input.name,
    address: input.address,
    website: input.website,
    phone: input.phone,
    rating: input.rating,
    userRatingCount: input.userRatingCount,
  });
}
