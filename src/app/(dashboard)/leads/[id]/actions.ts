"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { leadInteractionService } from "@/src/server/lead-interactions/lead-interaction.service";
import { prisma } from "@/lib/prisma/client";
import { LeadStatusService } from "@/src/server/leads/lead-status.service";
import { createChangeLeadStatusAction } from "@/src/server/leads/lead-status-action";

const changeStatus = createChangeLeadStatusAction({
  getUser: getCurrentUser,
  service: new LeadStatusService(prisma),
  invalidate: (leadId) => {
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  },
});

export async function changeLeadStatusAction(input: unknown) {
  return changeStatus(input);
}

const createInteractionSchema = z.object({
  leadId: z.string().uuid(),

  channel: z.enum(["WHATSAPP", "INSTAGRAM", "EMAIL", "PHONE", "OTHER"]),

  type: z.enum([
    "FIRST_CONTACT",
    "FOLLOW_UP",
    "RESPONSE_RECEIVED",
    "MEETING",
    "OTHER",
  ]),

  notes: z.string().trim().max(2000).optional(),
});

export interface CreateInteractionActionState {
  success: boolean;
  error?: string;
}

export async function createInteractionAction(
  input: unknown,
): Promise<CreateInteractionActionState> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "Sua sessão expirou. Faça login novamente.",
    };
  }

  const result = createInteractionSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      error: "Dados da interação inválidos.",
    };
  }

  try {
    await leadInteractionService.create(result.data, user.id);

    revalidatePath(`/leads/${result.data.leadId}`);

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Lead não encontrado.") {
      return {
        success: false,
        error: "Lead não encontrado.",
      };
    }

    throw error;
  }
}
