"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { MonthlySalesService } from "@/src/server/finance/monthly-sales.service";
import { createSaveMonthlyGoalAction } from "@/src/server/finance/monthly-sales-action";

const save = createSaveMonthlyGoalAction({
  getUser: getCurrentUser,
  service: new MonthlySalesService(prisma),
  invalidate: () => revalidatePath("/dashboard"),
});

export async function saveMonthlySalesGoalAction(input: unknown) {
  return save(input);
}
