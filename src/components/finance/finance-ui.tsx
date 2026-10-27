import type { ReactNode } from "react";
import Link from "next/link";
import { statusLabels } from "@/src/server/finance/recurring.schema";

export function ContractStatusBadge({
  status,
}: {
  status: keyof typeof statusLabels;
}) {
  const color =
    status === "ATIVO"
      ? "bg-primary/10 text-primary"
      : status === "SUSPENSO"
        ? "bg-amber-400/10 text-amber-300"
        : "bg-sidebar-hover text-secundary";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-none ${color}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

export const contractRowGrid =
  "grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-[minmax(0,1fr)_10rem_12rem]";
export function FinanceNavigation({ view }: { view: string }) {
  return (
    <nav
      aria-label="Visões do financeiro"
      className="grid grid-cols-2 gap-1 border-b border-sidebar-hover px-2 sm:flex sm:gap-7 sm:px-5"
    >
      {[
        ["sales", "Vendas"],
        ["accounts", "Contas a receber"],
        ["receipts", "Recebimentos"],
        ["contracts", "Contratos"],
      ].map(([key, label]) => (
        <Link
          key={key}
          href={
            key === "contracts"
              ? "/financeiro/contratos"
              : `/financeiro?view=${key}`
          }
          aria-current={view === key ? "page" : undefined}
          className={`flex min-h-12 items-center justify-center border-b-2 px-1 py-3 text-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary sm:shrink-0 sm:text-sm ${view === key ? "border-primary text-primary" : "border-transparent text-secundary hover:text-foreground"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export const receivableRowGrid =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 xl:grid-cols-[minmax(0,1fr)_6.25rem_5rem_9rem_8.5rem_1rem]";
export const financeInput =
  "mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-sidebar-hover bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 [color-scheme:dark]";
export const financeButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sidebar-hover px-4 py-2 text-sm font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
export const financePrimary =
  financeButton +
  " border-transparent bg-primary text-background hover:bg-primary/85";
export function FinanceField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm font-medium">
      {label}
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  );
}
export function FinanceTotals({
  sold,
  received,
  outstanding,
  scope = "overview",
}: {
  sold: string;
  received: string;
  outstanding: string;
  scope?: "overview" | "sale";
}) {
  return (
    <dl
      aria-label={scope === "sale" ? "Resumo da venda" : "Resumo financeiro"}
      className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-sidebar-hover bg-card p-4 sm:grid-cols-3 sm:gap-8 sm:p-6"
    >
      {[
        [scope === "sale" ? "Valor da venda" : "Total vendido", sold],
        [scope === "sale" ? "Recebido" : "Total recebido", received],
        ["Saldo pendente", outstanding],
      ].map(([label, value]) => (
        <div
          key={label}
          className={`min-w-0 ${label === "Saldo pendente" ? "order-first col-span-2 sm:order-none sm:col-span-1" : ""}`}
        >
          <dt className="text-xs text-secundary sm:text-sm">{label}</dt>
          <dd
            className={`mt-1 break-words font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-2xl ${label === "Saldo pendente" ? "text-2xl" : "text-sm"} ${label === "Total recebido" || label === "Recebido" ? "text-primary" : ""}`}
          >
            {Number(value).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}
