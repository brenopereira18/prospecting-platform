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
      const temporary = cause.issues.some(issue => issue.code === "custom" && issue.params?.reason === "TEMPORARY_IMAGES");
      return { success: false, code: temporary ? "TEMPORARY_IMAGES" : "INVALID_INPUT",
        error: temporary ? "Substitua as imagens temporárias por imagens do template antes de salvar." : "Dados inválidos. Revise os campos indicados.",
        fieldErrors: Object.fromEntries(cause.issues.map(issue => [issue.path.join("."), issue.message])) };
    }
    console.error("Falha na persistência de protótipos:", cause);
    return { success: false, code: "UNEXPECTED", error: "Não foi possível concluir a operação. Suas alterações locais foram mantidas. Tente novamente." };
  }
}

export async function createPrototypeAction(input: unknown): Promise<PrototypeActionResult<PrototypeDTO>> {
  return authenticated(userId => prototypeService.create(input, userId));
}
export async function savePrototypeDraftAction(input: unknown): Promise<PrototypeActionResult<PrototypeDTO>> {
  return authenticated(userId => prototypeService.updateDraft(input, userId));
}
export async function createPrototypeVersionAction(input: unknown): Promise<PrototypeActionResult<PrototypeVersionDTO>> {
  return authenticated(userId => prototypeService.createVersion(input, userId));
}
