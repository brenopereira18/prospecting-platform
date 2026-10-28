"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareAsaasAction,
  saveAsaasPolicyAction,
  reconcileAsaasAction,
  cancelAsaasAction,
  retryAsaasEventsAction,
  asaasContractStatusAction,
  startPublicCheckoutAction,
} from "@/src/app/actions/asaas";
import {
  financeButton,
  financePrimary,
  financeInput,
  FinanceField,
} from "./finance-ui";
import type { AsaasPolicyInput } from "@/src/server/finance/asaas.schema";

type Result = { success: boolean; error: string };
function useOperation() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [feedback, setFeedback] = useState("");
  const running = useRef(false);
  function run(task: () => Promise<Result>) {
    if (running.current) return;
    running.current = true;
    start(async () => {
      try {
        const r = await task();
        setFeedback(r.success ? "Operação concluída." : r.error);
        router.refresh();
      } catch {
        setFeedback("Conexão interrompida. Concilie antes de repetir.");
      } finally {
        running.current = false;
      }
    });
  }
  return { busy, run, feedback };
}
export function CheckoutControls({
  saleId,
  contractId,
  checkoutId,
  status,
  subscriptionId,
  revision,
}: {
  saleId: string;
  contractId?: string;
  checkoutId?: string;
  status?: string;
  subscriptionId?: string | null;
  revision?: number;
}) {
  const { busy, run, feedback } = useOperation();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const active =
    checkoutId && !["CANCELED", "EXPIRED", "REJECTED"].includes(status ?? "");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!active && (
          <button
            disabled={busy}
            className={financePrimary}
            onClick={() =>
              run(() =>
                prepareAsaasAction({
                  saleId,
                  ...(contractId ? { contractId } : {}),
                }),
              )
            }
          >
            {busy
              ? "Preparando…"
              : contractId
                ? "Preparar contratação mensal"
                : "Preparar checkout"}
          </button>
        )}
        {checkoutId && (
          <button
            disabled={busy}
            className={financeButton}
            onClick={() => run(() => reconcileAsaasAction(checkoutId))}
          >
            Conciliar
          </button>
        )}
        {active && (
          <button
            disabled={busy}
            className={financeButton}
            onClick={() => setConfirm((v) => !v)}
          >
            {subscriptionId ? "Cancelar recorrência" : "Cancelar checkout"}
          </button>
        )}
        <button
          disabled={busy}
          className={financeButton}
          onClick={() => run(() => retryAsaasEventsAction())}
        >
          Reprocessar eventos
        </button>
      </div>
      {confirm && (
        <form
          className="space-y-3 rounded-lg border border-sidebar-hover p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!checkoutId) return;
            run(() =>
              subscriptionId && contractId
                ? asaasContractStatusAction({
                    id: contractId,
                    expectedRevision: revision,
                    status: "CANCELADO",
                    reason,
                  })
                : cancelAsaasAction(checkoutId),
            );
            setConfirm(false);
          }}
        >
          <p className="text-sm">
            {subscriptionId
              ? "Encerrar a assinatura no Asaas e cancelar o contrato? O Asaas também remove cobranças pendentes da assinatura. O histórico local será preservado."
              : "Cancelar este checkout? O histórico financeiro será preservado."}
          </p>
          {subscriptionId && (
            <FinanceField label="Motivo">
              <input
                required
                minLength={3}
                maxLength={1000}
                className={financeInput}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FinanceField>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={financeButton}
              onClick={() => setConfirm(false)}
            >
              Voltar
            </button>
            <button disabled={busy} className={financeButton + " text-red-300"}>
              Confirmar cancelamento
            </button>
          </div>
        </form>
      )}
      {feedback && (
        <p role="status" className="text-sm text-secundary">
          {feedback}
        </p>
      )}
    </div>
  );
}
export function AsaasPolicyForm({ initial }: { initial: AsaasPolicyInput }) {
  const [policy, setPolicy] = useState(initial);
  const { busy, run, feedback } = useOperation();
  return (
    <form
      className="space-y-4 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveAsaasPolicyAction(policy));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FinanceField label="Limite geral de parcelas">
          <input
            className={financeInput}
            type="number"
            min={1}
            max={21}
            required
            value={policy.maxInstallments}
            onChange={(e) =>
              setPolicy({ ...policy, maxInstallments: Number(e.target.value) })
            }
          />
        </FinanceField>
        <FinanceField label="Valor mínimo por parcela (R$)">
          <input
            className={financeInput}
            inputMode="decimal"
            required
            value={policy.minInstallment}
            onChange={(e) =>
              setPolicy({ ...policy, minInstallment: e.target.value })
            }
          />
        </FinanceField>
      </div>
      <p className="text-xs text-secundary">
        Taxas absorvidas pelo vendedor. Repasse automático não disponível neste
        checkout. O limite final depende da bandeira e das regras do Asaas.
      </p>
      {policy.bands.map((band, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <FinanceField label="A partir de (R$)">
            <input
              className={financeInput}
              inputMode="decimal"
              required
              value={band.from}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  bands: policy.bands.map((b, j) =>
                    j === i ? { ...b, from: e.target.value } : b,
                  ),
                })
              }
            />
          </FinanceField>
          <FinanceField label="Até parcelas">
            <input
              className={financeInput}
              type="number"
              min={1}
              max={21}
              required
              value={band.maxInstallments}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  bands: policy.bands.map((b, j) =>
                    j === i
                      ? { ...b, maxInstallments: Number(e.target.value) }
                      : b,
                  ),
                })
              }
            />
          </FinanceField>
          <button
            type="button"
            aria-label={`Remover faixa ${i + 1}`}
            className={financeButton}
            onClick={() =>
              setPolicy({
                ...policy,
                bands: policy.bands.filter((_, j) => j !== i),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || policy.bands.length >= 10}
          type="button"
          className={financeButton}
          onClick={() =>
            setPolicy({
              ...policy,
              bands: [
                ...policy.bands,
                { from: "1000.00", maxInstallments: policy.maxInstallments },
              ],
            })
          }
        >
          Adicionar faixa
        </button>
        <button disabled={busy} className={financePrimary}>
          Salvar regras
        </button>
      </div>
      <p className="text-xs text-secundary">
        Regras aplicadas aos próximos checkouts. Abaixo da primeira faixa,
        pagamento à vista.
      </p>
      {feedback && (
        <p role="status" className="text-sm">
          {feedback}
        </p>
      )}
    </form>
  );
}
export function PublicCheckoutButton({
  token,
  authorization,
}: {
  token: string;
  authorization?: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (running.current) return;
        running.current = true;
        setBusy(true);
        try {
          const r = await startPublicCheckoutAction(token, accepted);
          if (r.success) window.location.assign(r.url);
          else setError(r.error);
        } catch {
          setError("Não foi possível abrir o checkout. Tente novamente.");
        } finally {
          setBusy(false);
          running.current = false;
        }
      }}
    >
      {authorization && (
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1.5 size-4 shrink-0 accent-primary"
          />
          {authorization}
        </label>
      )}
      <button
        className={financePrimary + " w-full"}
        disabled={busy || (!!authorization && !accepted)}
      >
        {busy ? "Abrindo checkout…" : "Continuar no Asaas"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
