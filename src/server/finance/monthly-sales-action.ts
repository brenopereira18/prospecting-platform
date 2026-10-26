import {
  monthlySalesGoalSchema,
  type SaveMonthlyGoalResult,
} from "./monthly-sales.schema";
import type { MonthlySalesService } from "./monthly-sales.service";

export function createSaveMonthlyGoalAction(dependencies: {
  getUser: () => Promise<{ id: string } | null>;
  service: Pick<MonthlySalesService, "saveGoal">;
  invalidate: () => void | Promise<void>;
}) {
  return async (input: unknown): Promise<SaveMonthlyGoalResult> => {
    try {
      const user = await dependencies.getUser();
      if (!user)
        return {
          success: false,
          error: "Sua sessão expirou. Faça login novamente.",
        };
      const parsed = monthlySalesGoalSchema.safeParse(input);
      if (!parsed.success)
        return {
          success: false,
          error: "Revise os campos indicados.",
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ]),
          ),
        };
      await dependencies.service.saveGoal(parsed.data, user.id);
      await dependencies.invalidate();
      return { success: true };
    } catch (error) {
      console.error(
        "Falha ao salvar a meta mensal:",
        error instanceof Error ? error.name : "UnknownError",
      );
      return {
        success: false,
        error:
          "Não foi possível salvar a meta. O valor preenchido foi mantido; tente novamente.",
      };
    }
  };
}
