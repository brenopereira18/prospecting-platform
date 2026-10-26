"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposalDTO } from "@/src/server/proposals/proposal.schema";
import {
  formatMoney,
  moneyCents,
} from "@/src/server/proposals/proposal.schema";
import {
  collectionSchedule,
  conditionsSchema,
  type Conditions,
} from "@/src/server/finance/finance.schema";
import { createSaleAction } from "@/src/app/actions/finance";
import { FinanceField, financeInput, financePrimary } from "./finance-ui";
function FixedCondition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-secundary">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
export function SaleForm({
  proposal,
  today,
}: {
  proposal: ProposalDTO;
  today: string;
}) {
  const router = useRouter(),
    pending = useRef(false),
    requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [soldOn, setSoldOn] = useState(today);
  const [conditions, setConditions] = useState<Conditions>({
    total: proposal.total,
    deposit: proposal.deposit ?? "0.00",
    depositMethod: proposal.depositMethod ?? "PIX",
    depositInstallments: proposal.depositInstallments ?? 1,
    balanceMethod: proposal.balanceMethod ?? "PIX",
    balanceInstallments: proposal.balanceInstallments ?? 1,
    depositDueOn: today,
    balanceDueOn: today,
  });
  const fixed = proposal.paymentMode === "DEFINIDAS";
  const update = <K extends keyof Conditions>(key: K, value: Conditions[K]) =>
    setConditions((v) => ({ ...v, [key]: value }));
  const valid = conditionsSchema.safeParse(conditions),
    schedule = valid.success ? collectionSchedule(valid.data) : [];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setFields({});
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await createSaleAction({
        id: requestId.current,
        proposalId: proposal.id,
        leadId: proposal.leadId,
        expectedProposalRevision: proposal.revision,
        soldOn,
        conditions,
      });
      if (!result.success) {
        setError(result.error);
        setFields(result.fields ?? {});
        return;
      }
      router.push(`/financeiro/vendas/${result.saleId}`);
      router.refresh();
    } catch {
      setError(
        "Não foi possível concluir. Tente novamente com os dados preenchidos.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]"
    >
      <fieldset
        disabled={busy}
        className="min-w-0 space-y-4 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6 lg:sticky lg:top-6"
      >
        <legend className="sr-only">Condições acordadas</legend>
        <div>
          <h2 className="text-lg font-semibold">Condições acordadas</h2>
          <p className="mt-2 text-sm leading-6 text-secundary">
            {fixed
              ? "Condições da proposta aceita. Defina os vencimentos."
              : "Confirme as condições negociadas com o cliente."}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FixedCondition
            label="Total do desenvolvimento"
            value={formatMoney(proposal.total)}
          />
          <FinanceField label="Data da venda" error={fields.soldOn}>
            <input
              required
              type="date"
              className={financeInput}
              max={today}
              value={soldOn}
              onChange={(e) => setSoldOn(e.target.value)}
            />
          </FinanceField>
        </div>
        {fixed ? (
          <FixedCondition
            label="Entrada"
            value={
              moneyCents(conditions.deposit) > 0
                ? formatMoney(conditions.deposit)
                : "Sem entrada"
            }
          />
        ) : (
          <FinanceField
            label="Entrada (R$)"
            error={fields["conditions.deposit"]}
          >
            <input
              required
              inputMode="decimal"
              aria-label="Entrada (R$)"
              aria-describedby="sale-entry-help"
              className={financeInput}
              value={conditions.deposit}
              onChange={(e) => update("deposit", e.target.value)}
            />
            <span
              id="sale-entry-help"
              className="mt-1 block text-xs font-normal text-secundary"
            >
              Use zero para pagamento integral.
            </span>
          </FinanceField>
        )}
        {(["deposit", "balance"] as const)
          .filter(
            (part) =>
              !valid.success ||
              (part === "deposit"
                ? moneyCents(valid.data.deposit) > 0
                : moneyCents(valid.data.total) >
                  moneyCents(valid.data.deposit)),
          )
          .map((part) => (
            <div
              key={part}
              className="space-y-3 border-t border-sidebar-hover pt-4"
            >
              <h3 className="text-sm font-semibold">
                {part === "deposit"
                  ? "Entrada"
                  : moneyCents(conditions.deposit) > 0
                    ? "Saldo"
                    : "Pagamento integral"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {fixed ? (
                  <FixedCondition
                    label="Pagamento"
                    value={
                      conditions[`${part}Method`] === "PIX"
                        ? "Pix"
                        : `Cartão de crédito · ${conditions[`${part}Installments`]} ${conditions[`${part}Installments`] === 1 ? "parcela" : "parcelas"}`
                    }
                  />
                ) : (
                  <>
                    <FinanceField
                      label="Forma de pagamento"
                      error={fields[`conditions.${part}Method`]}
                    >
                      <select
                        aria-label="Forma de pagamento"
                        className={financeInput}
                        value={conditions[`${part}Method`]}
                        onChange={(e) => {
                          update(
                            `${part}Method`,
                            e.target.value as "PIX" | "CARTAO",
                          );
                          if (e.target.value === "PIX")
                            update(`${part}Installments`, 1);
                        }}
                      >
                        <option value="PIX">Pix</option>
                        <option value="CARTAO">Cartão de crédito</option>
                      </select>
                    </FinanceField>
                    {conditions[`${part}Method`] === "CARTAO" && (
                      <FinanceField
                        label="Quantidade de parcelas"
                        error={fields[`conditions.${part}Installments`]}
                      >
                        <input
                          required
                          type="number"
                          min={1}
                          max={24}
                          className={financeInput}
                          value={conditions[`${part}Installments`]}
                          onChange={(e) =>
                            update(
                              `${part}Installments`,
                              Number(e.target.value),
                            )
                          }
                        />
                      </FinanceField>
                    )}
                  </>
                )}
                <FinanceField
                  label="Primeiro vencimento"
                  error={fields[`conditions.${part}DueOn`]}
                >
                  <input
                    required
                    type="date"
                    className={financeInput}
                    value={conditions[`${part}DueOn`]}
                    onChange={(e) => update(`${part}DueOn`, e.target.value)}
                  />
                </FinanceField>
              </div>
            </div>
          ))}
        <p className="text-xs leading-5 text-secundary">
          Parcelas mensais. Hospedagem não incluída nesta venda.
        </p>
      </fieldset>
      <aside className="min-w-0 space-y-4 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6 lg:sticky lg:top-6">
        <div>
          <h2 className="text-lg font-semibold">Contas a receber</h2>
        </div>
        <ol className="max-h-96 divide-y divide-sidebar-hover overflow-y-auto">
          {schedule.map((row) => (
            <li
              key={row.sequence}
              className="flex flex-wrap justify-between gap-2 py-2.5 text-sm"
            >
              <div>
                {row.description}
                <p className="mt-1 text-xs text-secundary">
                  {row.dueOn.split("-").reverse().join("/")} ·{" "}
                  {row.paymentMethod === "PIX" ? "Pix" : "Cartão"}
                </p>
              </div>
              <strong className="tabular-nums">
                {formatMoney(row.amount)}
              </strong>
            </li>
          ))}
        </ol>
        {!valid.success && (
          <p className="text-sm text-secundary">
            Revise as condições para calcular as parcelas.
          </p>
        )}
        <p className="text-sm leading-6 text-secundary">
          Registrar a venda não confirma pagamentos. As condições serão
          preservadas após a confirmação.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button disabled={busy} className={`${financePrimary} w-full`}>
          {busy ? "Registrando…" : "Registrar venda"}
        </button>
      </aside>
    </form>
  );
}
