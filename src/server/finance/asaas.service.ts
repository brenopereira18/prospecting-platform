import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import {
  AsaasClient,
  AsaasError,
  hostedCheckoutUrl,
  type AsaasConfig,
} from "./asaas.client";
import {
  asaasPolicySchema,
  defaultAsaasPolicy,
  installmentLimit,
  checkoutCommandSchema,
  checkoutTermsSchema,
  asaasPaymentSchema,
  financialAmounts,
  webhookSchema,
  firstAsaasDueDate,
} from "./asaas.schema";
import { FinanceError, FinanceService } from "./finance.service";
import { todayInSaoPaulo } from "./finance.schema";
import { contractStatusSchema } from "./recurring.schema";
import { RecurringService } from "./recurring.service";
import { centsMoney, moneyCents } from "../proposals/proposal.schema";

const terminal = ["CANCELED", "EXPIRED", "REJECTED"];
const date = (s: string) => new Date(`${s}T00:00:00Z`);
const notFound = () =>
  new FinanceError("NOT_FOUND", "Cobrança não encontrada.");
const conflict = (message: string) => new FinanceError("CONFLICT", message);
const remoteId = (id: string) => encodeURIComponent(id);
export const ASAAS_EVENT_MAX_ATTEMPTS = 8;
const eventLeaseMs = 180000;
const eventRetryDelaysMs = [
  60000, 300000, 900000, 3600000, 14400000, 43200000, 86400000,
];

export class AsaasService {
  constructor(
    private db: PrismaClient,
    private api: AsaasClient,
    private config: AsaasConfig,
  ) {}
  private owner(userId: string) {
    if (!userId || userId !== this.config.ownerUserId)
      throw new FinanceError(
        "UNAUTHENTICATED",
        "Esta conta não está habilitada para a integração Asaas.",
      );
  }
  async policy(userId: string) {
    this.owner(userId);
    return asaasPolicySchema.parse(
      (await this.db.asaasPolicy.findUnique({ where: { userId } }))?.rules ??
        defaultAsaasPolicy,
    );
  }
  async savePolicy(input: unknown, userId: string) {
    this.owner(userId);
    const rules = asaasPolicySchema.parse(input);
    await this.db.asaasPolicy.upsert({
      where: { userId },
      create: { userId, rules },
      update: { rules },
    });
  }
  async list(saleId: string, contractId: string | null, userId: string) {
    this.owner(userId);
    return this.db.asaasCheckout.findMany({
      where: { saleId, contractId, sale: { userId, lead: { userId } } },
      include: { payments: { orderBy: { dueOn: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
  async prepare(input: unknown, userId: string) {
    this.owner(userId);
    const cmd = checkoutCommandSchema.parse(input);
    const policy = await this.policy(userId);
    // Explicit preparation, not page rendering: check previous remote attempts
    // before releasing an expired link. A failed read must not issue a new one.
    await this.refreshPreviousAttempts(cmd.saleId, cmd.contractId ?? null);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${cmd.saleId} AND "userId"=${userId} FOR UPDATE`,
      );
      const sale = await tx.sale.findFirst({
        where: { id: cmd.saleId, userId, lead: { userId } },
      });
      if (!sale) throw notFound();
      if (cmd.contractId)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM recurring_contracts WHERE id=${cmd.contractId} FOR UPDATE`,
        );
      const contract = cmd.contractId
        ? await tx.recurringContract.findFirst({
            where: { id: cmd.contractId, saleId: sale.id },
          })
        : null;
      if (cmd.contractId && !contract) throw notFound();
      if (contract) {
        if (contract.status !== "ATIVO")
          throw conflict(
            "Ative o contrato antes de oferecer a contratação recorrente.",
          );
      }
      await tx.asaasCheckout.updateMany({
        where: {
          saleId: sale.id,
          contractId: contract?.id ?? null,
          status: "PREPARED",
          providerId: null,
          expiresAt: { lte: new Date() },
        },
        data: { status: "EXPIRED", lastError: null },
      });
      const existing = await tx.asaasCheckout.findFirst({
        where: {
          saleId: sale.id,
          contractId: contract?.id ?? null,
          status: { notIn: terminal },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        if (existing.status !== "PAID")
          await this.assertNoPreviousPayment(
            tx,
            sale.id,
            contract?.id ?? null,
            existing.id,
          );
        if (existing.status === "ACTIVE" && existing.expiresAt <= new Date())
          throw conflict(
            "O prazo terminou, mas há cobrança ou processamento pendente. Concilie antes de preparar outro checkout.",
          );
        return existing;
      }
      await this.assertNoPreviousPayment(tx, sale.id, contract?.id ?? null);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM receivables WHERE "saleId"=${sale.id} ORDER BY id FOR UPDATE`,
      );
      let amount = sale.total;
      if (!contract) {
        const paid = await tx.receipt.aggregate({
          where: {
            receivable: { saleId: sale.id, contractId: null },
            reversal: null,
          },
          _sum: { amount: true },
        });
        amount = amount.minus(paid._sum.amount ?? 0);
        if (amount.lte(0)) throw conflict("Esta venda já está quitada.");
      } else {
        amount = contract.monthlyAmount;
        // Existing manual months must be settled/reviewed before starting automatic billing.
        if (
          await tx.receivable.count({
            where: {
              contractId: contract.id,
              competence: { gte: date(`${todayInSaoPaulo().slice(0, 7)}-01`) },
            },
          })
        )
          throw conflict(
            "Já existe mensalidade manual neste mês ou posterior. Inicie a recorrência no próximo período sem mensalidade gerada.",
          );
      }
      const today = todayInSaoPaulo();
      const due = contract
        ? firstAsaasDueDate(
            contract.dueDay,
            contract.startsOn.toISOString().slice(0, 10),
            today,
          )
        : undefined;
      const authorization = contract
        ? `Autorizo a cobrança automática mensal de R$ ${amount.toFixed(2).replace(".", ",")} no cartão, a partir de ${due}, pelos serviços: ${contract.description}. A hospedagem/manutenção é contratada separadamente do desenvolvimento do site. A recorrência continua até o cancelamento solicitado ao prestador.`
        : undefined;
      return tx.asaasCheckout.create({
        data: {
          saleId: sale.id,
          contractId: contract?.id,
          publicToken: randomBytes(32).toString("hex"),
          amount,
          expiresAt: new Date(Date.now() + 24 * 3600000),
          terms: {
            title: contract ? "Hospedagem e manutenção mensal" : sale.title,
            description: contract?.description ?? sale.title,
            clientName: sale.clientName,
            maxInstallments: contract
              ? 1
              : installmentLimit(amount.toFixed(2), policy),
            ...(contract
              ? {
                  contractRevision: contract.revision,
                  nextDueDate: due,
                  authorization,
                }
              : {}),
          },
        },
      });
    });
  }
  private async refreshPreviousAttempts(
    saleId: string,
    contractId: string | null,
    currentId?: string,
  ) {
    const previous = await this.db.asaasCheckout.findMany({
      where: {
        saleId,
        contractId,
        ...(currentId ? { id: { not: currentId } } : {}),
        sale: {
          userId: this.config.ownerUserId,
          lead: { userId: this.config.ownerUserId },
        },
        providerId: { not: null },
        OR: [
          { status: { in: terminal } },
          { status: "ACTIVE", expiresAt: { lte: new Date() } },
        ],
      },
    });
    for (const checkout of previous)
      await this.reconcile(checkout.id, this.config.ownerUserId);
  }
  private async assertNoPreviousPayment(
    tx: Prisma.TransactionClient,
    saleId: string,
    contractId: string | null,
    currentCheckoutId?: string,
  ) {
    const checkouts = await tx.asaasCheckout.findMany({
      where: { saleId, contractId },
      select: {
        id: true,
        providerId: true,
        status: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });
    const previous = checkouts.filter((c) => c.id !== currentCheckoutId);
    if (previous.some((c) => c.status === "PAID"))
      throw conflict(
        "Esta contratação já possui um checkout pago. Concilie o pagamento; não gere outra cobrança.",
      );
    if (
      previous.some(
        (c) => c.subscriptionId && c.subscriptionStatus !== "DELETED",
      )
    )
      throw conflict(
        "Esta contratação já possui uma assinatura. Concilie a recorrência antes de preparar outro link.",
      );
    const payment = await tx.asaasPayment.findFirst({
      where: {
        OR: [
          {
            checkoutId: { in: previous.map((c) => c.id) },
            status: { notIn: ["DELETED", "REFUNDED"] },
          },
          ...(currentCheckoutId
            ? [
                {
                  checkoutId: currentCheckoutId,
                  status: {
                    in: [
                      "CONFIRMED",
                      "RECEIVED",
                      "RECEIVED_IN_CASH",
                      "AUTHORIZED",
                      "AWAITING_RISK_ANALYSIS",
                    ],
                  },
                },
              ]
            : []),
        ],
      },
      select: { id: true },
    });
    const paidEvent = await tx.asaasEvent.findFirst({
      where: {
        userId: this.config.ownerUserId,
        OR: [
          {
            event: "CHECKOUT_PAID",
            OR: [
              { externalReference: { in: checkouts.map((c) => c.id) } },
              {
                resourceId: {
                  in: checkouts.flatMap((c) =>
                    c.providerId ? [c.providerId] : [],
                  ),
                },
              },
            ],
          },
          {
            event: { startsWith: "PAYMENT_" },
            processedAt: null,
            externalReference: { in: previous.map((c) => c.id) },
          },
          ...(currentCheckoutId
            ? [
                {
                  event: {
                    in: [
                      "PAYMENT_CONFIRMED",
                      "PAYMENT_RECEIVED",
                      "PAYMENT_AUTHORIZED",
                      "PAYMENT_AWAITING_RISK_ANALYSIS",
                    ],
                  },
                  processedAt: null,
                  externalReference: currentCheckoutId,
                },
              ]
            : []),
          // An unassociated financial event cannot safely be declared unrelated.
          {
            processedAt: null,
            externalReference: null,
            OR: [
              { event: "CHECKOUT_PAID" },
              { event: { startsWith: "PAYMENT_" } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    if (payment || paidEvent)
      throw conflict(
        "Já existe pagamento ou cobrança associada a esta contratação. Concilie antes de preparar outro checkout.",
      );
  }
  async publicCheckout(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw notFound();
    const row = await this.db.asaasCheckout.findFirst({
      where: { publicToken: token, sale: { userId: this.config.ownerUserId } },
    });
    if (!row) throw notFound();
    let blockedReason: string | null = null;
    if (["PREPARED", "ACTIVE"].includes(row.status)) {
      try {
        await this.db.$transaction((tx) =>
          this.assertNoPreviousPayment(tx, row.saleId, row.contractId, row.id),
        );
      } catch (error) {
        if (!(error instanceof FinanceError) || error.code !== "CONFLICT")
          throw error;
        blockedReason = error.message;
      }
    }
    return { ...row, blockedReason };
  }
  private async checkoutUrl(id: string) {
    return this.db.$transaction(async (tx) => {
      const found = await tx.asaasCheckout.findFirst({
        where: { id, sale: { userId: this.config.ownerUserId } },
      });
      if (!found) throw notFound();
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${found.saleId} FOR UPDATE`,
      );
      const current = await tx.asaasCheckout.findUniqueOrThrow({
        where: { id },
      });
      await this.assertNoPreviousPayment(
        tx,
        current.saleId,
        current.contractId,
        current.id,
      );
      if (current.status === "PAID")
        throw conflict(
          "Este checkout já foi pago. Não realize outro pagamento.",
        );
      if (
        current.status !== "ACTIVE" ||
        !current.providerId ||
        current.expiresAt <= new Date()
      )
        throw conflict(
          "Este checkout não está disponível. Concilie ou solicite outro link.",
        );
      return hostedCheckoutUrl(current.providerId);
    });
  }
  async start(token: string, accepted: boolean) {
    z.boolean().parse(accepted);
    const row = await this.publicCheckout(token);
    if (row.blockedReason) throw conflict(row.blockedReason);
    const terms = checkoutTermsSchema.parse(row.terms);
    if (row.contractId && !accepted)
      throw conflict(
        "Autorize explicitamente a cobrança mensal para continuar.",
      );
    if (row.status === "PAID")
      throw conflict("Este checkout já foi pago. Não realize outro pagamento.");
    if (row.status === "CANCELED" || row.status === "EXPIRED")
      throw conflict(
        "Este checkout foi encerrado. Solicite um novo link ao prestador.",
      );
    if (row.expiresAt <= new Date())
      throw conflict("Este link expirou. Solicite um novo link ao prestador.");
    await this.refreshPreviousAttempts(row.saleId, row.contractId, row.id);
    if (row.providerId && row.status === "ACTIVE")
      return this.checkoutUrl(row.id);
    if (row.status !== "PREPARED")
      throw conflict(
        "Este link já está em processamento. Solicite a conciliação ao prestador.",
      );
    // Reserve before remote I/O. A crash/timeout leaves UNKNOWN/CREATING, never a second POST.
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${row.saleId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM asaas_checkouts WHERE id=${row.id} FOR UPDATE`,
      );
      await this.assertNoPreviousPayment(
        tx,
        row.saleId,
        row.contractId,
        row.id,
      );
      if (row.contractId) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM recurring_contracts WHERE id=${row.contractId} FOR UPDATE`,
        );
        const c = await tx.recurringContract.findUnique({
          where: { id: row.contractId },
        });
        if (!c || c.status !== "ATIVO" || c.revision !== terms.contractRevision)
          throw conflict(
            "As condições foram alteradas. Solicite um novo link.",
          );
      }
      const claimed = await tx.asaasCheckout.updateMany({
        where: {
          id: row.id,
          status: "PREPARED",
          expiresAt: { gt: new Date() },
        },
        data: {
          status: "CREATING",
          requestedAt: new Date(),
          acceptedAt: row.contractId ? new Date() : null,
        },
      });
      if (!claimed.count) throw conflict("Checkout já está em processamento.");
    });
    const callback = {
      successUrl: `${this.config.origin}/pagamento/retorno`,
      cancelUrl: `${this.config.origin}/pagamento/retorno`,
      expiredUrl: `${this.config.origin}/pagamento/retorno`,
    };
    try {
      const result = z.object({ id: z.string().min(1) }).parse(
        await this.api.request("/checkouts", "POST", {
          billingTypes: row.contractId
            ? ["CREDIT_CARD"]
            : ["PIX", "CREDIT_CARD"],
          chargeTypes: row.contractId
            ? ["RECURRENT"]
            : terms.maxInstallments > 1
              ? ["DETACHED", "INSTALLMENT"]
              : ["DETACHED"],
          minutesToExpire: 60,
          externalReference: row.id,
          callback,
          items: [
            {
              name: terms.title.slice(0, 100),
              description: terms.description.slice(0, 500),
              quantity: 1,
              value: Number(row.amount.toFixed(2)),
            },
          ],
          ...(row.contractId
            ? {
                subscription: {
                  cycle: "MONTHLY",
                  nextDueDate: `${terms.nextDueDate} 12:00:00`,
                },
              }
            : terms.maxInstallments > 1
              ? { installment: { maxInstallmentCount: terms.maxInstallments } }
              : {}),
        }),
      );
      await this.db.asaasCheckout.updateMany({
        where: { id: row.id, status: { in: ["CREATING", "UNKNOWN"] } },
        data: {
          providerId: result.id,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 3600000),
          lastError: null,
        },
      });
    } catch (error) {
      await this.db.asaasCheckout.updateMany({
        where: { id: row.id, status: "CREATING" },
        data: {
          status:
            error instanceof AsaasError && !error.uncertain
              ? "REJECTED"
              : "UNKNOWN",
          lastError:
            error instanceof AsaasError && !error.uncertain
              ? error.message
              : "Criação não confirmada. Concilie antes de repetir.",
        },
      });
      throw error;
    }
    // A payment event may have arrived during remote I/O. Recheck before
    // delivering the new URL, without retrying or misclassifying the POST.
    await this.refreshPreviousAttempts(row.saleId, row.contractId, row.id);
    return this.checkoutUrl(row.id);
  }
  async reconcile(id: string, userId: string) {
    this.owner(userId);
    z.uuid().parse(id);
    const row = await this.db.asaasCheckout.findFirst({
      where: { id, sale: { userId } },
    });
    if (!row) throw notFound();
    if (
      row.status === "PREPARED" &&
      !row.providerId &&
      row.expiresAt <= new Date()
    ) {
      await this.db.asaasCheckout.updateMany({
        where: {
          id,
          status: "PREPARED",
          providerId: null,
          expiresAt: { lte: new Date() },
        },
        data: { status: "EXPIRED", lastError: null },
      });
      return;
    }
    if (!row.providerId)
      throw conflict(
        "O identificador remoto ainda não foi confirmado. Aguarde/reenvie o webhook CHECKOUT_CREATED no Asaas. Não emita outra cobrança.",
      );
    const payments = await this.api.payments(
      row.subscriptionId
        ? { subscription: row.subscriptionId }
        : { checkoutSession: row.providerId },
    );
    for (const p of payments) await this.syncPayment(p, row.id);
    if (row.subscriptionId)
      await this.syncSubscription(row.subscriptionId, true);
    // Checkout has no documented GET-by-ID endpoint. Its configured deadline,
    // together with a successful, empty payment query, permits safe expiration.
    // Never infer PAID or release UNKNOWN/CREATING/CANCELING from the clock.
    if (!row.subscriptionId && payments.length === 0)
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM sales WHERE id=${row.saleId} FOR UPDATE`,
        );
        const knownPayment = await tx.asaasPayment.count({
          where: { checkoutId: id, status: { notIn: ["DELETED", "REFUNDED"] } },
        });
        const paidNotification = await tx.asaasEvent.count({
          where: {
            userId: this.config.ownerUserId,
            event: "CHECKOUT_PAID",
            OR: [{ externalReference: id }, { resourceId: row.providerId! }],
          },
        });
        if (!knownPayment && !paidNotification)
          await tx.asaasCheckout.updateMany({
            where: {
              id,
              status: "ACTIVE",
              subscriptionId: null,
              expiresAt: { lte: new Date() },
            },
            data: { status: "EXPIRED", lastError: null },
          });
      });
  }
  async syncPayment(input: unknown, verifiedCheckoutId?: string) {
    const p = asaasPaymentSchema.parse(input);
    const existing = await this.db.asaasPayment.findUnique({
      where: { id: p.id },
    });
    const checkout = await this.db.asaasCheckout.findFirst({
      where: {
        sale: { userId: this.config.ownerUserId },
        OR: [
          ...(verifiedCheckoutId ? [{ id: verifiedCheckoutId }] : []),
          ...(existing ? [{ id: existing.checkoutId }] : []),
          ...(p.checkoutSession ? [{ providerId: p.checkoutSession }] : []),
          ...(p.subscription ? [{ subscriptionId: p.subscription }] : []),
        ],
      },
    });
    if (!checkout)
      throw conflict(
        "Cobrança aguardando associação ao checkout. Reprocesse após CHECKOUT_PAID.",
      );
    if (existing && existing.checkoutId !== checkout.id)
      throw conflict("Associação de cobrança divergente.");
    if (checkout.contractId && (!checkout.acceptedAt || !p.subscription))
      throw conflict("Assinatura sem contratação confirmada.");
    const amounts = financialAmounts(p);
    const receivedOn = p.creditDate ?? p.paymentDate;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${checkout.saleId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM asaas_checkouts WHERE id=${checkout.id} FOR UPDATE`,
      );
      const previous = await tx.asaasPayment.findUnique({
        where: { id: p.id },
      });
      // A stale concurrent fetch must never resurrect a refunded/charged-back payment.
      if (
        previous &&
        ["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(
          previous.status,
        ) &&
        !["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(
          p.status,
        )
      )
        return;
      if (
        previous?.status === "RECEIVED" &&
        ["PENDING", "CONFIRMED", "OVERDUE"].includes(p.status)
      )
        return;
      // Re-read current provider state before this method; webhook payloads are never settlement authority.
      if (p.subscription && checkout.contractId) {
        if (
          checkout.subscriptionId &&
          checkout.subscriptionId !== p.subscription
        )
          throw conflict("Assinatura divergente.");
        await tx.asaasCheckout.update({
          where: { id: checkout.id },
          data: { subscriptionId: p.subscription },
        });
      }
      const metadata = {
        status: p.deleted ? "DELETED" : p.status,
        billingType: p.billingType,
        grossAmount: centsMoney(amounts.gross),
        netAmount: amounts.net === null ? null : centsMoney(amounts.net),
        providerFee: amounts.fee === null ? null : centsMoney(amounts.fee),
        buyerCharges:
          amounts.buyerCharges === null
            ? null
            : centsMoney(amounts.buyerCharges),
        dueOn: date(p.dueDate),
        receivedOn:
          p.status === "RECEIVED" && receivedOn ? date(receivedOn) : null,
        subscriptionId: p.subscription,
        installmentId: p.installment,
        installmentNumber: p.installmentNumber,
        invoiceUrl:
          p.invoiceUrl && new URL(p.invoiceUrl).hostname === "sandbox.asaas.com"
            ? p.invoiceUrl
            : null,
        lastError: null,
      };
      await tx.asaasPayment.upsert({
        where: { id: p.id },
        create: { id: p.id, checkoutId: checkout.id, ...metadata },
        update: metadata,
      });
      if (
        p.status === "REFUNDED" ||
        p.status === "CHARGEBACK_REQUESTED" ||
        p.status === "CHARGEBACK_DISPUTE"
      ) {
        const receipts = await tx.receipt.findMany({
          where: { asaasPaymentId: p.id, reversal: null },
        });
        for (const r of receipts)
          await tx.receiptReversal.create({
            data: { receiptId: r.id, reason: `Asaas: ${p.status} (${p.id})` },
          });
        return;
      }
      let contractAccountId: string | undefined;
      if (checkout.contractId) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM recurring_contracts WHERE id=${checkout.contractId} FOR UPDATE`,
        );
        const competence = date(`${p.dueDate.slice(0, 7)}-01`);
        const account = await tx.receivable.findUnique({
          where: {
            contractId_competence: {
              contractId: checkout.contractId,
              competence,
            },
          },
        });
        if (account && !account.amount.equals(p.value))
          throw conflict(
            "Mensalidade existente diverge do valor Asaas. Revise sem sobrescrever o histórico.",
          );
        const terms = checkoutTermsSchema.parse(checkout.terms);
        if (!checkout.amount.equals(p.value))
          throw conflict(
            "Valor da assinatura difere das condições autorizadas.",
          );
        if (!account && !p.deleted) {
          contractAccountId = (
            await tx.receivable.create({
              data: {
                saleId: checkout.saleId,
                contractId: checkout.contractId,
                competence,
                description: terms.description,
                amount: p.value,
                dueOn: date(p.dueDate),
                paymentMethod: "CARTAO",
              },
            })
          ).id;
        } else contractAccountId = account?.id;
      }
      if (p.status !== "RECEIVED" || p.deleted) return; // CONFIRMED is not available cash.
      if (!receivedOn || receivedOn > todayInSaoPaulo())
        throw conflict(
          "Cobrança recebida sem data efetiva. Conciliação necessária.",
        );
      if (await tx.receipt.count({ where: { asaasPaymentId: p.id } })) return;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM receivables WHERE "saleId"=${checkout.saleId} ORDER BY id FOR UPDATE`,
      );
      const accounts = await tx.receivable.findMany({
        where: {
          saleId: checkout.saleId,
          ...(checkout.contractId
            ? { id: contractAccountId ?? "missing" }
            : { contractId: null }),
        },
        include: { receipts: { where: { reversal: null } } },
        orderBy: [{ dueOn: "asc" }, { id: "asc" }],
      });
      let remaining = amounts.gross - (amounts.buyerCharges ?? 0);
      const finance = new FinanceService(this.db);
      for (const account of accounts) {
        const paid = account.receipts.reduce(
          (sum, r) => sum + moneyCents(r.amount.toFixed(2)),
          0,
        );
        const balance = moneyCents(account.amount.toFixed(2)) - paid;
        const allocated = Math.min(balance, remaining);
        if (allocated <= 0) continue;
        await finance.receiveInTransaction(
          tx,
          {
            id: randomUUID(),
            receivableId: account.id,
            amount: centsMoney(allocated),
            receivedOn,
            paymentMethod: p.billingType === "PIX" ? "PIX" : "CARTAO",
            notes: `Liquidação Asaas ${p.id}. Valor comercial; taxas e líquido registrados na cobrança.`,
          },
          this.config.ownerUserId,
          p.id,
        );
        remaining -= allocated;
      }
      if (remaining !== 0)
        throw conflict(
          "O valor recebido excede as contas locais. Nenhuma baixa parcial foi aplicada; revise a conciliação.",
        );
    });
  }
  async syncSubscription(id: string, recovery = false) {
    const remote = z
      .object({
        id: z.string(),
        status: z.string(),
        deleted: z.boolean().optional(),
        value: z.number(),
        cycle: z.string(),
        externalReference: z.string().nullish(),
      })
      .parse(await this.api.request(`/subscriptions/${remoteId(id)}`));
    const row = await this.db.asaasCheckout.findFirst({
      where: {
        contractId: { not: null },
        acceptedAt: { not: null },
        sale: { userId: this.config.ownerUserId },
        OR: [
          { subscriptionId: id },
          ...(remote.externalReference
            ? [{ id: remote.externalReference }]
            : []),
        ],
      },
    });
    if (!row || (row.subscriptionId && row.subscriptionId !== id))
      throw conflict("Assinatura aguardando associação ao checkout.");
    if (
      row.subscriptionStatus?.startsWith("CHANGING_") &&
      (!recovery ||
        (row.requestedAt && row.requestedAt.getTime() > Date.now() - 90000))
    )
      throw conflict(
        "Alteração externa em andamento. Aguarde 90 segundos para conciliar uma operação interrompida.",
      );
    if (
      remote.id !== id ||
      remote.cycle !== "MONTHLY" ||
      !row.amount.equals(remote.value)
    )
      throw conflict("Condições externas divergentes. Revise a assinatura.");
    await this.db.asaasCheckout.update({
      where: { id: row.id },
      data: {
        subscriptionId: id,
        subscriptionStatus: remote.deleted ? "DELETED" : remote.status,
      },
    });
  }
  async cancel(id: string, userId: string) {
    this.owner(userId);
    z.uuid().parse(id);
    let row = await this.db.asaasCheckout.findFirst({
      where: { id, sale: { userId } },
    });
    if (!row) throw notFound();
    if (row.subscriptionId)
      throw conflict("Cancele a recorrência pelo controle do contrato.");
    if (terminal.includes(row.status)) return;
    if (row.status === "PAID")
      throw conflict(
        "Este checkout já foi pago e não pode ser cancelado por esta ação.",
      );
    if (["UNKNOWN", "CREATING", "CANCELING"].includes(row.status))
      throw conflict("Concilie a emissão incerta antes de cancelar.");
    if (row.providerId || row.expiresAt <= new Date()) {
      await this.reconcile(id, userId);
      row = await this.db.asaasCheckout.findFirst({
        where: { id, sale: { userId } },
      });
      if (!row) throw notFound();
      if (row.status === "CANCELED" || row.status === "EXPIRED") return;
      if (row.status === "PAID")
        throw conflict(
          "Este checkout já foi pago e não pode ser cancelado por esta ação.",
        );
      const payment = await this.db.asaasPayment.findFirst({
        where: { checkoutId: id, status: { notIn: ["DELETED", "REFUNDED"] } },
        select: { id: true },
      });
      if (payment)
        throw conflict(
          "Este checkout possui cobrança ou pagamento. Concilie e revise a cobrança no Asaas antes de cancelar.",
        );
    }
    // Claim before remote I/O: a concurrent start must not create a checkout
    // after the local cancellation has released the unique open-checkout slot.
    const candidate = row;
    const claimed = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales WHERE id=${candidate.saleId} FOR UPDATE`,
      );
      const payment = await tx.asaasPayment.count({
        where: { checkoutId: id, status: { notIn: ["DELETED", "REFUNDED"] } },
      });
      const notification = await tx.asaasEvent.findFirst({
        where: {
          userId: this.config.ownerUserId,
          OR: [
            {
              event: "CHECKOUT_PAID",
              OR: [
                { externalReference: id },
                ...(candidate.providerId
                  ? [{ resourceId: candidate.providerId }]
                  : []),
              ],
            },
            {
              event: { startsWith: "PAYMENT_" },
              externalReference: id,
              processedAt: null,
            },
          ],
        },
      });
      if (payment || notification)
        throw conflict(
          "Este checkout possui pagamento ou notificação pendente. Concilie antes de cancelar.",
        );
      return tx.asaasCheckout.updateMany({
        where: { id, status: candidate.status, subscriptionId: null },
        data: { status: "CANCELING", requestedAt: new Date() },
      });
    });
    if (!claimed.count)
      throw conflict("O checkout mudou. Concilie antes de repetir.");
    try {
      if (row.providerId)
        await this.api.request(
          `/checkouts/${remoteId(row.providerId)}/cancel`,
          "POST",
        );
      await this.db.asaasCheckout.updateMany({
        where: { id, status: "CANCELING" },
        data: { status: "CANCELED", lastError: null },
      });
    } catch (error) {
      await this.db.asaasCheckout.updateMany({
        where: { id, status: "CANCELING" },
        data: {
          ...(error instanceof AsaasError && !error.uncertain
            ? { status: row.status }
            : {}),
          lastError:
            error instanceof AsaasError
              ? error.message
              : "Cancelamento não confirmado. Concilie antes de emitir outro checkout.",
        },
      });
      throw error;
    }
  }
  async changeContractStatus(input: unknown, userId: string) {
    this.owner(userId);
    const cmd = contractStatusSchema.parse(input);
    const row = await this.db.asaasCheckout.findFirst({
      where: {
        contractId: cmd.id,
        status: { notIn: terminal },
        sale: { userId },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row?.subscriptionId)
      throw conflict(
        "Concilie ou cancele o checkout pendente antes de alterar o contrato.",
      );
    const contract = await this.db.recurringContract.findUnique({
      where: { id: cmd.id },
    });
    if (!contract || contract.revision !== cmd.expectedRevision)
      throw conflict("O contrato mudou. Atualize a página.");
    if (
      contract.status === "CANCELADO" ||
      (row.subscriptionStatus === "DELETED" && cmd.status !== "CANCELADO")
    )
      throw conflict("Recorrência cancelada não pode ser reativada.");
    if (row.subscriptionStatus?.startsWith("CHANGING_"))
      throw conflict(
        "Alteração externa em andamento. Concilie antes de repetir.",
      );
    const claimed = await this.db.asaasCheckout.updateMany({
      where: { id: row.id, subscriptionStatus: row.subscriptionStatus },
      data: {
        subscriptionStatus: `CHANGING_${cmd.status}`,
        requestedAt: new Date(),
        lastError: null,
      },
    });
    if (!claimed.count)
      throw conflict(
        "Alteração externa em andamento. Concilie antes de repetir.",
      );
    try {
      if (cmd.status === "CANCELADO") {
        if (row.subscriptionStatus !== "DELETED")
          await this.api.request(
            `/subscriptions/${remoteId(row.subscriptionId)}`,
            "DELETE",
          );
        await this.db.asaasCheckout.update({
          where: { id: row.id },
          data: { subscriptionStatus: "DELETED" },
        });
      } else {
        const nextDueDate = firstAsaasDueDate(
          contract.dueDay,
          contract.startsOn.toISOString().slice(0, 10),
          todayInSaoPaulo(),
        );
        await this.api.request(
          `/subscriptions/${remoteId(row.subscriptionId)}`,
          "PUT",
          {
            status: cmd.status === "ATIVO" ? "ACTIVE" : "INACTIVE",
            ...(cmd.status === "ATIVO" ? { nextDueDate } : {}),
            updatePendingPayments: false,
          },
        );
        await this.db.asaasCheckout.update({
          where: { id: row.id },
          data: {
            subscriptionStatus: cmd.status === "ATIVO" ? "ACTIVE" : "INACTIVE",
          },
        });
      }
      await new RecurringService(this.db).changeStatus(cmd, userId);
      if (cmd.status === "CANCELADO")
        await this.db.asaasCheckout.update({
          where: { id: row.id },
          data: { status: "CANCELED" },
        });
    } catch (error) {
      await this.db.asaasCheckout.update({
        where: { id: row.id },
        data: {
          lastError:
            "Alteração externa não concluída localmente. Concilie e repita a mesma operação antes de continuar.",
        },
      });
      throw error;
    }
  }
  async storeEvent(input: unknown) {
    const payload = webhookSchema.parse(input);
    const resource = payload.event.startsWith("CHECKOUT_")
      ? payload.checkout!
      : payload.event.startsWith("PAYMENT_")
        ? payload.payment!
        : payload.subscription!;
    const rawReference =
      payload.checkout?.externalReference ??
      payload.subscription?.externalReference ??
      null;
    const matches: Prisma.AsaasCheckoutWhereInput[] = payload.checkout
      ? [
          { providerId: resource.id },
          ...(rawReference ? [{ id: rawReference }] : []),
        ]
      : payload.payment
        ? [
            { payments: { some: { id: resource.id } } },
            ...(payload.payment.checkoutSession
              ? [{ providerId: payload.payment.checkoutSession }]
              : []),
            ...(payload.payment.subscription
              ? [{ subscriptionId: payload.payment.subscription }]
              : []),
          ]
        : [
            { subscriptionId: resource.id },
            ...(rawReference ? [{ id: rawReference }] : []),
          ];
    const linked = await this.db.asaasCheckout.findFirst({
      where: { sale: { userId: this.config.ownerUserId }, OR: matches },
    });
    return this.db.$transaction(async (tx) => {
      // Serialize known notifications with preparation and URL delivery. Only
      // identifiers are stored, never the payment/customer/card payload.
      if (linked)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM sales WHERE id=${linked.saleId} FOR UPDATE`,
        );
      const reference = linked?.id ?? rawReference;
      await tx.asaasEvent.createMany({
        data: [
          {
            id: payload.id,
            userId: this.config.ownerUserId,
            event: payload.event,
            resourceId: resource.id,
            externalReference: reference,
          },
        ],
        skipDuplicates: true,
      });
      const stored = await tx.asaasEvent.findUniqueOrThrow({
        where: { id: payload.id },
      });
      if (
        (stored.userId && stored.userId !== this.config.ownerUserId) ||
        (!stored.userId && !linked) ||
        stored.event !== payload.event ||
        stored.resourceId !== resource.id ||
        (stored.externalReference &&
          reference &&
          stored.externalReference !== reference)
      )
        throw conflict("Evento repetido com conteúdo divergente.");
      if ((!stored.externalReference && reference) || !stored.userId)
        await tx.asaasEvent.update({
          where: { id: payload.id },
          data: {
            userId: this.config.ownerUserId,
            ...(!stored.externalReference && reference
              ? { externalReference: reference }
              : {}),
            // A legacy orphan may have been incorrectly marked processed by the
            // previous implementation. Reopen only on verified owner association.
            ...(!stored.userId && linked
              ? {
                  processedAt: null,
                  failedAt: null,
                  nextAttemptAt: null,
                  error: null,
                }
              : {}),
          },
        });
      return payload.id;
    });
  }
  async acceptEvent(input: unknown) {
    return this.processEvent(await this.storeEvent(input));
  }
  async processEvent(id: string, retryFailed = false) {
    z.boolean().parse(retryFailed);
    const event = await this.db.asaasEvent.findUniqueOrThrow({
      where: { id, userId: this.config.ownerUserId },
    });
    if (
      event.processedAt ||
      (event.failedAt && !retryFailed) ||
      (event.nextAttemptAt && event.nextAttemptAt > new Date())
    )
      return false;
    // A process may have died during the last allowed attempt. Expiring its
    // lease must not create an unlimited stream of additional automatic tries.
    if (event.attempts >= ASAAS_EVENT_MAX_ATTEMPTS && !retryFailed) {
      await this.db.asaasEvent.updateMany({
        where: {
          id,
          processedAt: null,
          failedAt: null,
          attempts: event.attempts,
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        data: {
          failedAt: new Date(),
          nextAttemptAt: null,
          error:
            "Limite de tentativas atingido após interrupção. Revise e reavalie o evento.",
        },
      });
      return false;
    }
    const attempt = event.attempts + 1;
    const claimed = await this.db.asaasEvent.updateMany({
      where: {
        id,
        processedAt: null,
        failedAt: event.failedAt,
        attempts: event.attempts,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      data: {
        attempts: { increment: 1 },
        failedAt: null,
        nextAttemptAt: new Date(Date.now() + eventLeaseMs),
      },
    });
    if (!claimed.count) return false;
    try {
      if (event.event.startsWith("CHECKOUT_")) {
        const row = await this.db.asaasCheckout.findFirst({
          where: {
            sale: { userId: this.config.ownerUserId },
            OR: [
              { providerId: event.resourceId },
              ...(event.externalReference
                ? [{ id: event.externalReference }]
                : []),
            ],
          },
        });
        if (!row)
          throw conflict(
            "Checkout aguardando associação. O evento permanece disponível para recuperação.",
          );
        if (row.providerId && row.providerId !== event.resourceId)
          throw conflict("Checkout externo divergente.");
        const status = event.event.slice("CHECKOUT_".length);
        await this.db.$transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM sales WHERE id=${row.saleId} FOR UPDATE`,
          );
          const bound = await tx.asaasCheckout.updateMany({
            where: {
              id: row.id,
              OR: [{ providerId: null }, { providerId: event.resourceId }],
            },
            data: { providerId: event.resourceId },
          });
          if (!bound.count)
            throw conflict(
              "Checkout externo divergente. Revise a associação do evento.",
            );
          if (status === "CREATED")
            await tx.asaasCheckout.updateMany({
              where: { id: row.id, status: { in: ["CREATING", "UNKNOWN"] } },
              data: { status: "ACTIVE" },
            });
          else if (status === "PAID" || terminal.includes(status))
            await tx.asaasCheckout.updateMany({
              where: {
                id: row.id,
                ...(status === "PAID" ? {} : { status: { not: "PAID" } }),
              },
              data: { status, lastError: null },
            });
        });
        if (status === "PAID")
          await this.reconcile(row.id, this.config.ownerUserId);
      } else if (event.event.startsWith("PAYMENT_")) {
        const p = asaasPaymentSchema.parse(
          await this.api.request(`/payments/${remoteId(event.resourceId)}`),
        );
        if (p.id !== event.resourceId)
          throw conflict("Identificador da cobrança divergente.");
        const linked = await this.db.asaasCheckout.findFirst({
          where: {
            sale: { userId: this.config.ownerUserId },
            OR: [
              { payments: { some: { id: p.id } } },
              ...(p.checkoutSession ? [{ providerId: p.checkoutSession }] : []),
              ...(p.subscription ? [{ subscriptionId: p.subscription }] : []),
            ],
          },
        });
        if (linked) {
          await this.db.$transaction(async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM sales WHERE id=${linked.saleId} FOR UPDATE`,
            );
            if (
              event.externalReference &&
              event.externalReference !== linked.id
            )
              throw conflict("Associação de evento de pagamento divergente.");
            await tx.asaasEvent.updateMany({
              where: { id, attempts: attempt, processedAt: null },
              data: { externalReference: linked.id },
            });
          });
        }
        await this.syncPayment(p);
      } else if (event.event === "SUBSCRIPTION_DELETED") {
        const matched = await this.db.asaasCheckout.updateMany({
          where: {
            subscriptionId: event.resourceId,
            sale: { userId: this.config.ownerUserId },
          },
          data: { subscriptionStatus: "DELETED" },
        });
        if (!matched.count)
          throw conflict(
            "Assinatura aguardando associação. Revise e reavalie o evento.",
          );
      } else await this.syncSubscription(event.resourceId);
      const completed = await this.db.asaasEvent.updateMany({
        where: { id, processedAt: null, attempts: attempt },
        data: {
          processedAt: new Date(),
          error: null,
          nextAttemptAt: null,
          failedAt: null,
        },
      });
      return completed.count > 0;
    } catch (error) {
      const exhausted = attempt >= ASAAS_EVENT_MAX_ATTEMPTS;
      await this.db.asaasEvent.updateMany({
        where: { id, processedAt: null, attempts: attempt },
        data: {
          failedAt: exhausted ? new Date() : null,
          nextAttemptAt: exhausted
            ? null
            : new Date(Date.now() + eventRetryDelaysMs[attempt - 1]),
          error:
            error instanceof FinanceError || error instanceof AsaasError
              ? error.message
              : "Falha de conciliação. Tente novamente.",
        },
      });
      throw error;
    }
  }
  async failedEventsCount(userId: string) {
    this.owner(userId);
    return this.db.asaasEvent.count({
      where: {
        userId: this.config.ownerUserId,
        processedAt: null,
        failedAt: { not: null },
      },
    });
  }
  async retryEvents(userId: string, retryFailed = false) {
    this.owner(userId);
    z.boolean().parse(retryFailed);
    const pending = await this.db.asaasEvent.findMany({
      where: {
        userId: this.config.ownerUserId,
        processedAt: null,
        ...(retryFailed
          ? { failedAt: { not: null } }
          : {
              failedAt: null,
              OR: [
                { nextAttemptAt: null },
                { nextAttemptAt: { lte: new Date() } },
              ],
            }),
      },
      orderBy: { createdAt: "asc" },
      take: 25,
    });
    let processed = 0;
    for (const e of pending)
      try {
        if (await this.processEvent(e.id, retryFailed)) processed++;
      } catch {
        /* recorded, retryable */
      }
    return {
      processed,
      pending: await this.db.asaasEvent.count({
        where: {
          userId: this.config.ownerUserId,
          processedAt: null,
          failedAt: null,
        },
      }),
      failed: await this.failedEventsCount(userId),
    };
  }
}
