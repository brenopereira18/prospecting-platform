import { z } from "zod";
import { amountSchema, financeDate, paymentMethod } from "./finance.schema";

export const contractStatuses = ["ATIVO", "SUSPENSO", "CANCELADO"] as const;
export const contractKinds = ["HOSPEDAGEM", "MANUTENCAO", "AMBOS"] as const;
export const kindLabels = {
  HOSPEDAGEM: "Hospedagem",
  MANUTENCAO: "Manutenção",
  AMBOS: "Hospedagem e manutenção",
};
export const statusLabels = {
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};
export const competenceSchema = z
  .string()
  .regex(
    /^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/,
    "Informe uma competência válida (mês e ano).",
  )
  .refine((v) => v <= "9997-12", "Competência fora do intervalo permitido.");
export const contractTermsSchema = z.strictObject({
  kind: z.enum(contractKinds),
  description: z
    .string()
    .trim()
    .min(3, "Descreva os serviços contratados.")
    .max(3000),
  monthlyAmount: amountSchema,
  dueDay: z.number().int().min(1).max(31),
  paymentMethod,
  notes: z.string().trim().max(3000),
});
export const createContractSchema = z.strictObject({
  id: z.uuid(),
  saleId: z.uuid(),
  startsOn: financeDate,
  terms: contractTermsSchema,
});
const command = z.strictObject({
  id: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
});
export const updateContractSchema = command.extend({
  terms: contractTermsSchema,
});
export const contractStatusSchema = command.extend({
  status: z.enum(contractStatuses),
  reason: z.string().trim().min(3, "Informe o motivo da alteração.").max(1000),
});
export const generateMonthlySchema = z.strictObject({
  id: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  competence: competenceSchema,
});
export type ContractTerms = z.infer<typeof contractTermsSchema>;
export type ContractResult =
  | { success: true; contractId: string }
  | { success: false; error: string; fields?: Record<string, string> };

/** Civil dates (UTC storage), never the host timezone. First month is not prorated. */
export function monthlyDueOn(
  competence: string,
  dueDay: number,
  startsOn: string,
) {
  competenceSchema.parse(competence);
  z.number().int().min(1).max(31).parse(dueDay);
  financeDate.parse(startsOn);
  const [year, month] = competence.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = `${competence}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
  return competence === startsOn.slice(0, 7) && date < startsOn
    ? startsOn
    : date;
}
