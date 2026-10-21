"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { prototypeService, PrototypeError } from "@/src/server/prototypes/prototype.service";
import type { PrototypeActionResult, PrototypeDTO, PrototypeVersionDTO } from "@/src/server/prototypes/prototype.dto";

async function authenticated<T>(operation: (userId: string) => Promise<T>): Promise<PrototypeActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, code: "UNAUTHENTICATED", error: "Sua sessão expirou. Faça login novamente." };
  try {
    const data = await operation(user.id);
    revalidatePath("/prototipos");
    return { success: true, data };
  } catch (cause) {
    if (cause instanceof PrototypeError) return { success: false, code: cause.code, error: cause.message };
    if (cause instanceof z.ZodError) {
      if (cause.issues.some(issue => issue.path.length === 1 && issue.path[0] === "configuration" && issue.code === "invalid_type")) {
        return { success: false, code: "INVALID_INPUT", error: "Atualize esta página e preencha a configuração do estabelecimento antes de criar o protótipo." };
      }
      const temporary = cause.issues.some(issue => issue.code === "custom" && issue.params?.reason === "TEMPORARY_IMAGES");
      return { success: false, code: temporary ? "TEMPORARY_IMAGES" : "INVALID_INPUT",
        error: temporary ? "Substitua as imagens temporárias por imagens do template antes de salvar." : "Dados inválidos. Revise os campos indicados.",
        fieldErrors: Object.fromEntries(cause.issues.map(issue => [issue.path.join("."), issue.message])) };
    }
    console.error("Falha na persistência de protótipos:", cause);
    return { success: false, code: "UNEXPECTED", error: "Não foi possível concluir a operação. Suas alterações locais foram mantidas. Tente novamente." };
  }
}

// Keep old action references readable for stale tabs, without creating a generic draft.
export async function createPrototypeAction(): Promise<PrototypeActionResult<PrototypeDTO>> {
  return authenticated(async () => {
    throw new PrototypeError("INVALID_INPUT", "O fluxo de criação foi atualizado. Atualize a página e preencha a configuração do lead antes de criar o protótipo.");
  });
}
export async function createLeadPrototypeAction(input: unknown): Promise<PrototypeActionResult<PrototypeDTO>> {
  return authenticated(userId => prototypeService.createFromLead(input, userId));
}
export async function savePrototypeDraftAction(input: unknown): Promise<PrototypeActionResult<PrototypeDTO>> {
  return authenticated(userId => prototypeService.updateDraft(input, userId));
}
export async function createPrototypeVersionAction(input: unknown): Promise<PrototypeActionResult<PrototypeVersionDTO>> {
  return authenticated(userId => prototypeService.createVersion(input, userId));
}
export async function deletePrototypeAction(input: unknown): Promise<PrototypeActionResult<{ id: string; leadId: string | null }>> {
  return authenticated(async userId => {
    const deleted = await prototypeService.delete(input, userId);
    if (deleted.leadId) {
      revalidatePath(`/leads/${deleted.leadId}`);
      revalidatePath(`/leads/${deleted.leadId}/prototipos/novo`);
    }
    revalidatePath(`/prototipos/${deleted.id}`);
    return deleted;
  });
}
