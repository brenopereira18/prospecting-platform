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
      const existing = await tx.asaasCheckout.findFirst({
        where: {
          saleId: sale.id,
          contractId: contract?.id ?? null,
          status: { notIn: terminal },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return existing;
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
  async publicCheckout(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw notFound();
    const row = await this.db.asaasCheckout.findFirst({
      where: { publicToken: token, sale: { userId: this.config.ownerUserId } },
    });
    if (!row) throw notFound();
    return row;
  }
  async start(token: string, accepted: boolean) {
    z.boolean().parse(accepted);
    const row = await this.publicCheckout(token);
    const terms = checkoutTermsSchema.parse(row.terms);
    if (row.contractId && !accepted)
      throw conflict(
        "Autorize explicitamente a cobrança mensal para continuar.",
      );
    if (row.expiresAt <= new Date())
      throw conflict("Este link expirou. Solicite um novo link ao prestador.");
    if (row.providerId && row.status === "ACTIVE")
      return hostedCheckoutUrl(row.providerId);
    if (row.status !== "PREPARED")
      throw conflict(
        "Este link já está em processamento. Solicite a conciliação ao prestador.",
      );
    // Reserve before remote I/O. A crash/timeout leaves UNKNOWN/CREATING, never a second POST.
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM asaas_checkouts WHERE id=${row.id} FOR UPDATE`,
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
        where: { id: row.id, status: "PREPARED" },
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
      return hostedCheckoutUrl(result.id);
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
  }
  async reconcile(id: string, userId: string) {
    this.owner(userId);
    z.uuid().parse(id);
    const row = await this.db.asaasCheckout.findFirst({
      where: { id, sale: { userId } },
    });
    if (!row) throw notFound();
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
    const row = await this.db.asaasCheckout.findFirst({
      where: { id, sale: { userId } },
    });
    if (!row) throw notFound();
    if (row.subscriptionId)
      throw conflict("Cancele a recorrência pelo controle do contrato.");
    if (row.status === "CANCELED") return;
    if (["UNKNOWN", "CREATING", "CANCELING"].includes(row.status))
      throw conflict("Concilie a emissão incerta antes de cancelar.");
    // Claim before remote I/O: a concurrent start must not create a checkout
    // after the local cancellation has released the unique open-checkout slot.
    const claimed = await this.db.asaasCheckout.updateMany({
      where: { id, status: row.status, subscriptionId: null },
      data: { status: "CANCELING", requestedAt: new Date() },
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
            "Cancelamento não confirmado. Confira o checkout no Asaas e reenvie seu evento antes de emitir outro.",
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
    const reference =
      payload.checkout?.externalReference ??
      payload.subscription?.externalReference ??
      null;
    await this.db.asaasEvent.createMany({
      data: [
        {
          id: payload.id,
          event: payload.event,
          resourceId: resource.id,
          externalReference: reference,
        },
      ],
      skipDuplicates: true,
    });
    const stored = await this.db.asaasEvent.findUniqueOrThrow({
      where: { id: payload.id },
    });
    if (stored.event !== payload.event || stored.resourceId !== resource.id)
      throw conflict("Evento repetido com conteúdo divergente.");
    return payload.id;
  }
  async acceptEvent(input: unknown) {
    return this.processEvent(await this.storeEvent(input));
  }
  async processEvent(id: string) {
    const event = await this.db.asaasEvent.findUniqueOrThrow({ where: { id } });
    if (event.processedAt) return;
    await this.db.asaasEvent.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
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
        if (row) {
          if (row.providerId && row.providerId !== event.resourceId)
            throw conflict("Checkout externo divergente.");
          const status = event.event.slice("CHECKOUT_".length);
          await this.db.asaasCheckout.update({
            where: { id: row.id },
            data: {
              providerId: event.resourceId,
              ...(status === "CREATED"
                ? row.status === "CREATING" || row.status === "UNKNOWN"
                  ? { status: "ACTIVE" }
                  : {}
                : status === "PAID"
                  ? { status: "PAID" }
                  : terminal.includes(status) && row.status !== "PAID"
                    ? { status }
                    : {}),
            },
          });
          if (status === "PAID")
            await this.reconcile(row.id, this.config.ownerUserId);
        }
      } else if (event.event.startsWith("PAYMENT_")) {
        const p = asaasPaymentSchema.parse(
          await this.api.request(`/payments/${remoteId(event.resourceId)}`),
        );
        if (p.id !== event.resourceId)
          throw conflict("Identificador da cobrança divergente.");
        await this.syncPayment(p);
      } else if (event.event === "SUBSCRIPTION_DELETED") {
        await this.db.asaasCheckout.updateMany({
          where: {
            subscriptionId: event.resourceId,
            sale: { userId: this.config.ownerUserId },
          },
          data: { subscriptionStatus: "DELETED" },
        });
      } else await this.syncSubscription(event.resourceId);
      await this.db.asaasEvent.update({
        where: { id },
        data: { processedAt: new Date(), error: null },
      });
    } catch (error) {
      await this.db.asaasEvent.update({
        where: { id },
        data: {
          error:
            error instanceof FinanceError
              ? error.message
              : "Falha de conciliação. Tente novamente.",
        },
      });
      throw error;
    }
  }
  async retryEvents(userId: string) {
    this.owner(userId);
    const pending = await this.db.asaasEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      take: 25,
    });
    let processed = 0;
    for (const e of pending)
      try {
        await this.processEvent(e.id);
        processed++;
      } catch {
        /* recorded, retryable */
      }
    return { processed, pending: pending.length - processed };
  }
}
