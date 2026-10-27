"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { FinanceError } from "@/src/server/finance/finance.service";
import { RecurringService } from "@/src/server/finance/recurring.service";
import type { ContractResult } from "@/src/server/finance/recurring.schema";

const service = new RecurringService(prisma);
async function execute(
  operation: (userId: string) => Promise<{ contractId: string }>,
): Promise<ContractResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      success: false,
      error: "Sua sessão expirou. Faça login novamente.",
    };
  try {
    const result = await operation(user.id);
    revalidatePath("/financeiro/contratos", "layout");
    revalidatePath("/financeiro/vendas/[id]", "page");
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
    console.error("Falha na operação de contrato recorrente.", error);
    return {
      success: false,
      error:
        "Não foi possível concluir. Seus dados foram mantidos; tente novamente.",
    };
  }
}
export async function createContractAction(input: unknown) {
  return execute((user) => service.create(input, user));
}
export async function updateContractAction(input: unknown) {
  return execute((user) => service.update(input, user));
}
export async function contractStatusAction(input: unknown) {
  return execute((user) => service.changeStatus(input, user));
}
export async function generateMonthlyAction(input: unknown) {
  return execute((user) => service.generate(input, user));
}
