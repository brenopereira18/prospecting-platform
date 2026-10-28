import { z } from "zod";
import { amountSchema } from "./finance.schema";
import { moneyCents } from "../proposals/proposal.schema";
import { monthlyDueOn } from "./recurring.schema";

/** Next configured due day, never a past day or an invented immediate charge. */
export function firstAsaasDueDate(
  dueDay: number,
  startsOn: string,
  today: string,
) {
  z.iso.date().parse(startsOn);
  z.iso.date().parse(today);
  const anchor = startsOn > today ? startsOn : today;
  let month = anchor.slice(0, 7);
  let due = monthlyDueOn(month, dueDay, `${month}-01`);
  if (due < anchor) {
    const [year, number] = month.split("-").map(Number);
    month = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
    due = monthlyDueOn(month, dueDay, `${month}-01`);
  }
  return due;
}

export const asaasPolicySchema = z
  .strictObject({
    maxInstallments: z.number().int().min(1).max(21),
    minInstallment: amountSchema.refine(
      (v) => moneyCents(v) >= 500,
      "O mínimo do Asaas é R$ 5 por parcela.",
    ),
    costMode: z.literal("SELLER", {
      error:
        "O Checkout API não oferece repasse automático documentado. As taxas são absorvidas pelo vendedor.",
    }),
    bands: z
      .array(
        z.strictObject({
          from: amountSchema,
          maxInstallments: z.number().int().min(1).max(21),
        }),
      )
      .max(10),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<number>();
    v.bands.forEach((b, i) => {
      const from = moneyCents(b.from);
      if (seen.has(from))
        ctx.addIssue({
          code: "custom",
          path: ["bands", i, "from"],
          message: "Faixa duplicada.",
        });
      seen.add(from);
      if (b.maxInstallments > v.maxInstallments)
        ctx.addIssue({
          code: "custom",
          path: ["bands", i, "maxInstallments"],
          message: "A faixa não pode ultrapassar o limite geral.",
        });
    });
  });
export type AsaasPolicyInput = z.infer<typeof asaasPolicySchema>;
export const defaultAsaasPolicy: AsaasPolicyInput = {
  maxInstallments: 1,
  minInstallment: "5.00",
  costMode: "SELLER",
  bands: [],
};
export function installmentLimit(amount: string, input: unknown) {
  const policy = asaasPolicySchema.parse(input);
  const cents = moneyCents(amount);
  if (cents < 500) throw new Error("Checkout com cartão exige ao menos R$ 5.");
  const band = [...policy.bands]
    .sort((a, b) => moneyCents(b.from) - moneyCents(a.from))
    .find((b) => cents >= moneyCents(b.from));
  return Math.max(
    1,
    Math.min(
      policy.maxInstallments,
      band?.maxInstallments ??
        (policy.bands.length ? 1 : policy.maxInstallments),
      Math.floor(cents / moneyCents(policy.minInstallment)),
    ),
  );
}
export const checkoutCommandSchema = z.strictObject({
  saleId: z.uuid(),
  contractId: z.uuid().optional(),
});
export const checkoutTermsSchema = z.object({
  title: z.string(),
  description: z.string(),
  clientName: z.string(),
  maxInstallments: z.number().int().min(1).max(21),
  contractRevision: z.number().int().optional(),
  nextDueDate: z.string().optional(),
  authorization: z.string().optional(),
});
const providerId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_&-]+$/);
const apiMoney = z
  .number()
  .finite()
  .nonnegative()
  .max(9999999999.99)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 0.0001);
export const asaasPaymentSchema = z.object({
  id: providerId,
  status: z.string().max(80),
  billingType: z.enum(["PIX", "CREDIT_CARD"]),
  value: apiMoney,
  netValue: apiMoney.nullish(),
  originalValue: apiMoney.nullish(),
  dueDate: z.iso.date(),
  paymentDate: z.iso.date().nullish(),
  creditDate: z.iso.date().nullish(),
  subscription: providerId.nullish(),
  installment: providerId.nullish(),
  installmentNumber: z.number().int().positive().nullish(),
  checkoutSession: providerId.nullish(),
  externalReference: z.string().nullish(),
  invoiceUrl: z.url().nullish(),
  deleted: z.boolean().optional(),
});
export const webhookSchema = z
  .object({
    id: providerId,
    event: z
      .string()
      .regex(/^(CHECKOUT|PAYMENT|SUBSCRIPTION)_[A-Z_]+$/)
      .max(100),
    checkout: z
      .object({
        id: providerId,
        externalReference: z.string().max(200).nullish(),
      })
      .optional(),
    payment: z.object({ id: providerId }).optional(),
    subscription: z
      .object({
        id: providerId,
        externalReference: z.string().max(200).nullish(),
      })
      .optional(),
  })
  .refine((v) =>
    v.event.startsWith("CHECKOUT_")
      ? !!v.checkout
      : v.event.startsWith("PAYMENT_")
        ? !!v.payment
        : !!v.subscription,
  );
export function financialAmounts(input: unknown) {
  const p = asaasPaymentSchema.parse(input);
  const gross = Math.round(p.value * 100);
  const net = p.netValue == null ? null : Math.round(p.netValue * 100);
  if (net !== null && net > gross)
    throw new Error("Valor líquido incompatível com a cobrança.");
  return {
    gross,
    net,
    fee: net === null ? null : gross - net,
    buyerCharges:
      p.originalValue == null
        ? null
        : Math.max(0, gross - Math.round(p.originalValue * 100)),
  };
}
