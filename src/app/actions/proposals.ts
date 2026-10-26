"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  ProposalError,
  ProposalService,
} from "@/src/server/proposals/proposal.service";
import type { ProposalResult } from "@/src/server/proposals/proposal.schema";

const service = new ProposalService(prisma);
async function execute(
  operation: (
    userId: string,
  ) => Promise<Extract<ProposalResult, { success: true }>["data"]>,
): Promise<ProposalResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      success: false,
      error: "Sua sessão expirou. Faça login novamente.",
    };
  try {
    const data = await operation(user.id);
    revalidatePath(`/leads/${data.leadId}`);
    revalidatePath(`/leads/${data.leadId}/propostas/${data.id}`);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        success: false,
        error: "Revise os campos indicados.",
        fields: Object.fromEntries(
          error.issues.map((issue) => [
            issue.path.at(-1)?.toString() ?? "form",
            issue.message,
          ]),
        ),
      };
    if (error instanceof ProposalError)
      return { success: false, error: error.message };
    console.error("Falha na operação de proposta comercial.", error);
    return {
      success: false,
      error:
        "Não foi possível concluir. Seus dados foram mantidos; tente novamente.",
    };
  }
}
export async function createProposalAction(input: unknown) {
  return execute((userId) => service.create(input, userId));
}
export async function updateProposalAction(input: unknown) {
  return execute((userId) => service.update(input, userId));
}
export async function changeProposalStatusAction(input: unknown) {
  return execute((userId) => service.changeStatus(input, userId));
}
export async function duplicateProposalAction(input: unknown) {
  return execute((userId) => service.duplicate(input, userId));
}
export async function deleteProposalAction(input: unknown) {
  return execute((userId) => service.delete(input, userId));
}
