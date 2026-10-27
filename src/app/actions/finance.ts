"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  FinanceError,
  FinanceService,
} from "@/src/server/finance/finance.service";
import type { FinanceResult } from "@/src/server/finance/finance.schema";
const service = new FinanceService(prisma);
async function execute(
  operation: (userId: string) => Promise<{ saleId: string; leadId: string }>,
): Promise<FinanceResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      success: false,
      error: "Sua sessão expirou. Faça login novamente.",
    };
  try {
    const result = await operation(user.id);
    revalidatePath("/dashboard");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/contratos", "layout");
    revalidatePath(`/financeiro/vendas/${result.saleId}`);
    revalidatePath(`/leads/${result.leadId}`, "page");
    revalidatePath(`/leads/${result.leadId}/propostas`, "layout");
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        success: false,
        error: "Revise os campos indicados.",
        fields: Object.fromEntries(
          error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      };
    if (error instanceof FinanceError)
      return { success: false, error: error.message };
    console.error("Falha na operação financeira.", error);
    return {
      success: false,
      error:
        "Não foi possível concluir. Os dados preenchidos foram mantidos; tente novamente.",
    };
  }
}
export async function createSaleAction(input: unknown) {
  return execute((user) => service.createSale(input, user));
}
export async function receiveAction(input: unknown) {
  return execute((user) => service.receive(input, user));
}
export async function reverseReceiptAction(input: unknown) {
  return execute((user) => service.reverse(input, user));
}
