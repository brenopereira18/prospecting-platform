import { z } from "zod";
import {
  proposalContentSchema,
  moneyCents,
  centsMoney,
} from "../proposals/proposal.schema";

export const financeDate = proposalContentSchema.shape.validUntil.refine(
  (value) => value <= "9997-12-31",
  "Informe uma data até 31/12/9997, permitindo o cálculo das parcelas.",
);
export const paymentMethod = z.enum(["PIX", "CARTAO"]);
export const amountSchema = proposalContentSchema.shape.total.refine(
  (v) => moneyCents(v) > 0,
  "Informe um valor maior que zero.",
);
export const conditionsSchema = z
  .strictObject({
    total: amountSchema,
    deposit: proposalContentSchema.shape.total,
    depositMethod: paymentMethod,
    depositInstallments: z.number().int().min(1).max(24),
    balanceMethod: paymentMethod,
    balanceInstallments: z.number().int().min(1).max(24),
    depositDueOn: financeDate,
    balanceDueOn: financeDate,
  })
  .superRefine((v, ctx) => {
    const deposit = moneyCents(v.deposit),
      balance = moneyCents(v.total) - deposit;
    if (balance < 0)
      ctx.addIssue({
        code: "custom",
        path: ["deposit"],
        message: "A entrada não pode ultrapassar o total.",
      });
    for (const part of ["deposit", "balance"] as const) {
      if (v[`${part}Method`] === "PIX" && v[`${part}Installments`] !== 1)
        ctx.addIssue({
          code: "custom",
          path: [`${part}Installments`],
          message: "Pix deve ter uma única parcela.",
        });
      const amount = part === "deposit" ? deposit : balance;
      if (amount > 0 && amount < v[`${part}Installments`])
        ctx.addIssue({
          code: "custom",
          path: [`${part}Installments`],
          message: "Cada parcela deve ter pelo menos R$ 0,01.",
        });
    }
  });
export const saleSchema = z.strictObject({
  id: z.uuid(),
  proposalId: z.uuid(),
  leadId: z.uuid(),
  expectedProposalRevision: z.number().int().nonnegative(),
  soldOn: financeDate,
  conditions: conditionsSchema,
});
export const receiptSchema = z.strictObject({
  id: z.uuid(),
  receivableId: z.uuid(),
  amount: amountSchema,
  receivedOn: financeDate,
  paymentMethod,
  notes: z.string().trim().max(2000),
});
export const reversalSchema = z.strictObject({
  receiptId: z.uuid(),
  reason: z.string().trim().min(3, "Explique o motivo do estorno.").max(1000),
});
export type Conditions = z.infer<typeof conditionsSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export function todayInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
function monthDate(anchor: string, offset: number) {
  const [year, month, day] = anchor.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
}
export function collectionSchedule(input: Conditions) {
  const v = conditionsSchema.parse(input);
  const rows: {
    sequence: number;
    description: string;
    amount: string;
    dueOn: string;
    paymentMethod: z.infer<typeof paymentMethod>;
  }[] = [];
  const deposit = moneyCents(v.deposit),
    balance = moneyCents(v.total) - deposit;
  for (const part of ["deposit", "balance"] as const) {
    const amount = part === "deposit" ? deposit : balance;
    if (!amount) continue;
    const count = v[`${part}Installments`];
    const label =
      part === "deposit" ? "Entrada" : deposit ? "Saldo" : "Pagamento integral";
    for (let i = 0; i < count; i++)
      rows.push({
        sequence: rows.length + 1,
        description:
          count === 1 ? label : `${label} · Parcela ${i + 1}/${count}`,
        amount: centsMoney(
          Math.floor(amount / count) + (i < amount % count ? 1 : 0),
        ),
        dueOn: monthDate(v[`${part}DueOn`], i),
        paymentMethod: v[`${part}Method`],
      });
  }
  return rows;
}
export function receivableState(
  amount: string,
  received: string,
  dueOn: string,
  today = todayInSaoPaulo(),
) {
  const outstanding = moneyCents(amount) - moneyCents(received);
  const status =
    outstanding === 0
      ? "Recebido"
      : moneyCents(received) > 0
        ? "Parcialmente recebido"
        : "Pendente";
  return {
    outstanding: centsMoney(outstanding),
    status,
    overdue: outstanding > 0 && dueOn.slice(0, 10) < today,
  };
}
export type FinanceResult =
  | { success: true; saleId: string; leadId: string }
  | { success: false; error: string; fields?: Record<string, string> };
