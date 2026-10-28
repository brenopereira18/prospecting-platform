import { asaasService } from "@/src/server/finance/asaas.runtime";
import { asaasConfig, AsaasError } from "@/src/server/finance/asaas.client";
import { CheckoutControls } from "./asaas-controls";
import { formatMoney } from "@/src/server/proposals/proposal.schema";
import Link from "next/link";

function UnavailablePayment({
  contractId,
  message,
}: {
  contractId?: string;
  message: string;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-sidebar-hover bg-card p-5">
      <h2 className="font-semibold">
        {contractId ? "Contratação mensal no cartão" : "Pagamento online"} ·
        Sandbox
      </h2>
      <p role="status" className="text-sm text-secundary">
        {message}
      </p>
      <p className="text-sm text-secundary">
        As ações abaixo serão liberadas após configurar a integração para sua
        conta. O link de pagamento aparece depois de preparar o checkout.
      </p>
      <div
        className="flex flex-wrap gap-2"
        aria-label="Ações aguardando configuração"
      >
        <button
          disabled
          className="min-h-11 rounded-lg border border-sidebar-hover px-3 text-sm opacity-50"
        >
          {contractId ? "Preparar contratação mensal" : "Preparar checkout"}
        </button>
        <button
          disabled
          className="min-h-11 rounded-lg border border-sidebar-hover px-3 text-sm opacity-50"
        >
          {contractId ? "Abrir contratação mensal" : "Abrir link de pagamento"}
        </button>
        <button
          disabled
          className="min-h-11 rounded-lg border border-sidebar-hover px-3 text-sm opacity-50"
        >
          Conciliar
        </button>
      </div>
      <Link
        href="/configuracoes#asaas"
        className="inline-flex min-h-11 items-center text-sm text-primary underline"
      >
        Configurar Asaas
      </Link>
    </section>
  );
}

export async function AsaasPanel({
  saleId,
  contractId,
  userId,
  revision,
}: {
  saleId: string;
  contractId?: string;
  userId: string;
  revision?: number;
}) {
  let config;
  try {
    config = asaasConfig();
  } catch (e) {
    return (
      <UnavailablePayment
        contractId={contractId}
        message={
          e instanceof AsaasError ? e.message : "Integração indisponível."
        }
      />
    );
  }
  if (config.ownerUserId !== userId)
    return (
      <UnavailablePayment
        contractId={contractId}
        message="A integração Asaas não está habilitada para sua conta."
      />
    );
  const service = asaasService();
  const rows = await service.list(saleId, contractId ?? null, userId);
  const row = rows[0];
  const labels: Record<string, string> = {
    PREPARED: "Pronto para compartilhar",
    ACTIVE: "Aguardando cliente",
    CREATING: "Em processamento",
    CANCELING: "Cancelamento aguardando confirmação",
    UNKNOWN: "Conciliação necessária",
    PAID: "Checkout concluído",
    CANCELED: "Cancelado",
    EXPIRED: "Expirado",
    REJECTED: "Emissão recusada",
  };
  return (
    <section className="space-y-4 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">
          {contractId ? "Contratação mensal no cartão" : "Pagamento online"}{" "}
          <span className="text-xs font-normal text-secundary">· Sandbox</span>
        </h2>
        <p className="mt-1 text-sm text-secundary">
          {contractId
            ? "Contratação separada do site, com autorização do cliente. Nenhuma mensalidade é considerada recebida antecipadamente."
            : "Pix ou cartão no checkout seguro do Asaas. A confirmação financeira ocorre por conciliação."}
        </p>
      </div>
      {row && (
        <div className="space-y-2 text-sm">
          <p>
            {labels[row.status] ?? row.status}
            {row.subscriptionStatus
              ? ` · Assinatura: ${row.subscriptionStatus}`
              : ""}
          </p>
          {["PREPARED", "ACTIVE"].includes(row.status) && (
            <a
              className="block break-all text-primary underline underline-offset-4"
              href={`/pagamento/${row.publicToken}`}
              target="_blank"
              rel="noreferrer"
            >
              {contractId
                ? "Abrir contratação mensal"
                : "Abrir link de pagamento"}
            </a>
          )}
          {row.lastError && <p className="text-amber-300">{row.lastError}</p>}
        </div>
      )}
      <Link
        href="/configuracoes#asaas"
        className="inline-flex min-h-9 items-center text-sm text-primary underline underline-offset-4"
      >
        Configuração e regras de parcelamento
      </Link>
      <CheckoutControls
        saleId={saleId}
        contractId={contractId}
        checkoutId={row?.id}
        status={row?.status}
        subscriptionId={row?.subscriptionId}
        revision={revision}
      />
      {rows.some((r) => r.payments.length > 0) && (
        <details className="border-t border-sidebar-hover pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Cobranças e conciliação
          </summary>
          <ul className="mt-3 divide-y divide-sidebar-hover">
            {rows
              .flatMap((r) => r.payments)
              .map((p) => (
                <li key={p.id} className="space-y-1 py-3 text-sm">
                  <p className="flex flex-wrap justify-between gap-2">
                    <span>
                      {p.billingType === "PIX" ? "Pix" : "Cartão"}
                      {p.installmentNumber
                        ? ` · Parcela ${p.installmentNumber}`
                        : ""}{" "}
                      · {p.status}
                    </span>
                    <strong>{formatMoney(p.grossAmount.toFixed(2))}</strong>
                  </p>
                  <p className="text-xs text-secundary">
                    Encargos:{" "}
                    {p.buyerCharges
                      ? formatMoney(p.buyerCharges.toFixed(2))
                      : "não informados"}{" "}
                    · Taxas:{" "}
                    {p.providerFee
                      ? formatMoney(p.providerFee.toFixed(2))
                      : "não informadas"}{" "}
                    · Líquido:{" "}
                    {p.netAmount
                      ? formatMoney(p.netAmount.toFixed(2))
                      : "não informado"}
                  </p>
                  {p.invoiceUrl && (
                    <a
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                      href={p.invoiceUrl}
                    >
                      Abrir cobrança no Asaas
                    </a>
                  )}
                  {p.lastError && (
                    <p role="status" className="text-amber-300">
                      {p.lastError}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs text-secundary">
            CONFIRMED indica aprovação; somente RECEIVED registra recebimento. O
            resumo da venda representa o valor comercial quitado, antes das
            taxas. Trocas de cartão e estornos devem ser tratados no Asaas.
          </p>
        </details>
      )}
    </section>
  );
}
