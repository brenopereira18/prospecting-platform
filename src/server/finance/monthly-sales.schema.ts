import { z } from "zod";
import { commercialMonthSchema } from "../leads/commercial-month";
import { amountSchema } from "./finance.schema";

export const monthlySalesGoalSchema = z.strictObject({
  month: commercialMonthSchema,
  amount: amountSchema,
});

export type MonthlySalesDTO = {
  month: string;
  label: string;
  partial: boolean;
  sold: string;
  saleCount: number;
  clients: number;
  averageTicket: string;
  goal: string | null;
  percentage: number | null;
  remaining: string | null;
  exceeded: string | null;
};

export type SaveMonthlyGoalResult =
  | { success: true }
  | { success: false; error: string; fields?: Record<string, string> };
