"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { asaasService } from "@/src/server/finance/asaas.runtime";
import { AsaasError } from "@/src/server/finance/asaas.client";
import { FinanceError } from "@/src/server/finance/finance.service";
import { z } from "zod";

function message(e: unknown) {
  return e instanceof z.ZodError
    ? (e.issues[0]?.message ?? "Revise os campos.")
    : e instanceof AsaasError || e instanceof FinanceError
      ? e.message
      : "Não foi possível concluir. Os dados foram preservados; concilie antes de repetir.";
}
async function execute(run: (userId: string) => Promise<void>) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Sua sessão expirou." };
  try {
    await run(user.id);
    revalidatePath("/financeiro", "layout");
    return { success: true, error: "" };
  } catch (e) {
    return { success: false, error: message(e) };
  }
}
export async function prepareAsaasAction(input: unknown) {
  return execute(async (user) => {
    await asaasService().prepare(input, user);
  });
}
export async function saveAsaasPolicyAction(input: unknown) {
  return execute((user) => asaasService().savePolicy(input, user));
}
export async function reconcileAsaasAction(id: string) {
  return execute((user) => asaasService().reconcile(id, user));
}
export async function cancelAsaasAction(id: string) {
  return execute((user) => asaasService().cancel(id, user));
}
export async function asaasContractStatusAction(input: unknown) {
  return execute((user) => asaasService().changeContractStatus(input, user));
}
export async function retryAsaasEventsAction() {
  return execute(async (user) => {
    const r = await asaasService().retryEvents(user);
    if (r.pending)
      throw new AsaasError(
        `${r.processed} eventos conciliados; ${r.pending} ainda exigem revisão.`,
      );
  });
}
export async function startPublicCheckoutAction(
  token: string,
  accepted: boolean,
) {
  try {
    return {
      success: true,
      url: await asaasService().start(token, accepted),
      error: "",
    };
  } catch (e) {
    return { success: false, url: "", error: message(e) };
  }
}
