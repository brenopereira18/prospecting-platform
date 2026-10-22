import {
  changeLeadStatusSchema,
  type ChangeLeadStatusActionResult,
} from "./lead-status.schema";
import { LeadStatusError, type LeadStatusService } from "./lead-status.service";

export function createChangeLeadStatusAction(dependencies: {
  getUser: () => Promise<{ id: string } | null>;
  service: Pick<LeadStatusService, "change">;
  invalidate: (leadId: string) => void | Promise<void>;
}) {
  return async (input: unknown): Promise<ChangeLeadStatusActionResult> => {
    const user = await dependencies.getUser();
    if (!user)
      return {
        success: false,
        code: "UNAUTHENTICATED",
        error: "Sua sessão expirou. Faça login novamente.",
      };
    const parsed = changeLeadStatusSchema.safeParse(input);
    if (!parsed.success)
      return {
        success: false,
        code: "INVALID_INPUT",
        error: "Selecione um status válido e atualize a página se necessário.",
      };
    try {
      const data = await dependencies.service.change(parsed.data, user.id);
      if (data.changed) await dependencies.invalidate(parsed.data.leadId);
      return { success: true, data };
    } catch (error) {
      if (error instanceof LeadStatusError)
        return { success: false, code: error.code, error: error.message };
      console.error(
        "Falha ao alterar o status do lead:",
        error instanceof Error ? error.name : "UnknownError",
      );
      return {
        success: false,
        code: "ERROR",
        error:
          "Não foi possível salvar o status. Atualize a página para conferir o estado atual antes de tentar novamente.",
      };
    }
  };
}
