import { z } from "zod";

export const proposalStatuses = [
  "RASCUNHO",
  "ENVIADA",
  "ACEITA",
  "RECUSADA",
  "EXPIRADA",
] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];
export const statusLabels: Record<ProposalStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};
export const nextStatuses: Record<ProposalStatus, ProposalStatus[]> = {
  RASCUNHO: ["ENVIADA"],
  ENVIADA: ["ACEITA", "RECUSADA", "EXPIRADA"],
  ACEITA: [],
  RECUSADA: [],
  EXPIRADA: [],
};
// Decimal strings cross the client/server boundary; arithmetic uses exact integer cents.
export function moneyCents(value: string): number {
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function centsMoney(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
const money = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}([.,]\d{1,2})?$/,
    "Informe um valor válido, com até duas casas decimais.",
  )
  .transform((value) => centsMoney(moneyCents(value)));
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Preencha este campo.")
    .max(max, `Use até ${max} caracteres.`);
const method = z.enum(["PIX", "CARTAO"]);
const installments = z.number().int().min(1).max(24);
const date = z
  .string()
  .regex(/^[1-9]\d{3}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Informe uma data válida.");
export const proposalContentSchema = z
  .strictObject({
    title: text(160),
    description: text(4000),
    scope: text(8000),
    total: money,
    paymentMode: z.enum(["A_NEGOCIAR", "DEFINIDAS"]).default("DEFINIDAS"),
    deposit: money.nullable().default(null),
    depositMethod: method.nullable().default(null),
    depositInstallments: installments.nullable().default(null),
    balanceMethod: method.nullable().default(null),
    balanceInstallments: installments.nullable().default(null),
    deliveryDays: z.number().int().min(1).max(3650),
    validUntil: date,
    notes: z.string().trim().max(4000),
    managedHosting: z.boolean(),
    monthlyAmount: money.nullable(),
    maintenance: z.string().trim().max(4000),
  })
  .superRefine((value, ctx) => {
    const issue = (path: keyof typeof value, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (moneyCents(value.total) <= 0)
      issue("total", "O valor total deve ser maior que zero.");
    const paymentFields = [
      "deposit",
      "depositMethod",
      "depositInstallments",
      "balanceMethod",
      "balanceInstallments",
    ] as const;
    for (const field of paymentFields) {
      if (value.paymentMode === "DEFINIDAS" && value[field] === null)
        issue(
          field,
          "Informe este campo para definir as condições de pagamento.",
        );
      if (value.paymentMode === "A_NEGOCIAR" && value[field] !== null)
        issue(
          field,
          "Condições a negociar não devem conter entrada, formas ou parcelas definidas.",
        );
    }
    if (value.paymentMode === "DEFINIDAS") {
      if (
        value.deposit !== null &&
        moneyCents(value.deposit) > moneyCents(value.total)
      )
        issue("deposit", "A entrada não pode ultrapassar o valor total.");
      if (value.depositMethod === "PIX" && value.depositInstallments !== 1)
        issue("depositInstallments", "Pix não permite parcelamento.");
      if (value.balanceMethod === "PIX" && value.balanceInstallments !== 1)
        issue("balanceInstallments", "Pix não permite parcelamento.");
    }
    if (
      value.managedHosting &&
      (!value.monthlyAmount || moneyCents(value.monthlyAmount) <= 0)
    )
      issue("monthlyAmount", "Informe a mensalidade da hospedagem.");
    if (!value.managedHosting && value.monthlyAmount !== null)
      issue(
        "monthlyAmount",
        "Propostas sem hospedagem não possuem mensalidade.",
      );
  });
export type ProposalContent = z.infer<typeof proposalContentSchema>;
export const createProposalSchema = z.strictObject({
  id: z.uuid(),
  leadId: z.uuid(),
  content: proposalContentSchema,
});
export const proposalCommandSchema = z.strictObject({
  id: z.uuid(),
  leadId: z.uuid(),
  expectedRevision: z.number().int().nonnegative().max(2147483646),
});
export const updateProposalSchema = proposalCommandSchema.extend({
  content: proposalContentSchema,
});
export const statusProposalSchema = proposalCommandSchema.extend({
  status: z.enum(proposalStatuses),
});
export const duplicateProposalSchema = proposalCommandSchema.extend({
  newId: z.uuid(),
});
export type ProposalDTO = ProposalContent & {
  id: string;
  leadId: string;
  sourceProposalId: string | null;
  status: ProposalStatus;
  revision: number;
  clientName: string;
  clientAddress: string | null;
  clientPhone: string | null;
  issuerName: string;
  issuerEmail: string;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  deletedAt: string | null;
};
export type ProposalResult =
  | { success: true; data: ProposalDTO }
  | { success: false; error: string; fields?: Record<string, string> };
export function formatMoney(value: string) {
  return (moneyCents(value) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
export function formatProposalDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );
}
export function balanceOf(value: Pick<ProposalContent, "total" | "deposit">) {
  if (value.deposit === null) return null;
  return centsMoney(moneyCents(value.total) - moneyCents(value.deposit));
}
