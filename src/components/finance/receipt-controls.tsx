"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { receiveAction, reverseReceiptAction } from "@/src/app/actions/finance";
import {
  FinanceField,
  financeInput,
  financeButton,
  financePrimary,
} from "./finance-ui";
import { formatMoney } from "@/src/server/proposals/proposal.schema";
export function ReceiptForm({
  accountId,
  balance,
  today,
  compact = false,
}: {
  accountId: string;
  balance: string;
  today: string;
  compact?: boolean;
}) {
  const router = useRouter(),
    pending = useRef(false),
    id = useRef<string | null>(null),
    form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [success, setSuccess] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setFields({});
    id.current ??= crypto.randomUUID();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await receiveAction({
        ...data,
        id: id.current,
        receivableId: accountId,
      });
      if (!result.success) {
        setError(result.error);
        setFields(result.fields ?? {});
        return;
      }
      id.current = null;
      form.current?.reset();
      setSuccess("Recebimento registrado.");
      router.refresh();
    } catch {
      setError("Não foi possível registrar. Seus dados foram mantidos.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <details className={compact ? "mt-2" : "mt-4"}>
      <summary className="cursor-pointer rounded text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">
        Registrar recebimento
      </summary>
      <form
        ref={form}
        onSubmit={submit}
        className={compact ? "mt-3 space-y-3" : "mt-4 space-y-4"}
      >
        <p className="text-xs text-secundary">
          Saldo disponível: {formatMoney(balance)}. Informe apenas o valor
          efetivamente recebido.
        </p>
        <fieldset
          disabled={busy}
          className={`grid min-w-0 sm:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}
        >
          <FinanceField label="Valor recebido (R$)" error={fields.amount}>
            <input
              required
              name="amount"
              inputMode="decimal"
              defaultValue={balance}
              key={balance}
              className={financeInput}
            />
          </FinanceField>
          <FinanceField label="Data do recebimento" error={fields.receivedOn}>
            <input
              required
              name="receivedOn"
              type="date"
              max={today}
              defaultValue={today}
              className={financeInput}
            />
          </FinanceField>
          <FinanceField
            label="Forma de pagamento efetiva"
            error={fields.paymentMethod}
          >
            <select
              name="paymentMethod"
              aria-label="Forma de pagamento efetiva"
              className={financeInput}
            >
              <option value="PIX">Pix</option>
              <option value="CARTAO">Cartão de crédito</option>
            </select>
          </FinanceField>
          <FinanceField label="Observação (opcional)" error={fields.notes}>
            <input name="notes" maxLength={2000} className={financeInput} />
          </FinanceField>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-primary">
            {success}
          </p>
        )}
        <button disabled={busy} className={financePrimary}>
          {busy ? "Registrando…" : "Confirmar recebimento"}
        </button>
      </form>
    </details>
  );
}
export function ReverseReceipt({
  receiptId,
  amount,
}: {
  receiptId: string;
  amount: string;
}) {
  const router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null),
    pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const reason = new FormData(e.currentTarget).get("reason");
    try {
      const result = await reverseReceiptAction({ receiptId, reason });
      if (!result.success) {
        setError(result.error);
        return;
      }
      dialog.current?.close();
      router.refresh();
    } catch {
      setError("Não foi possível estornar. Tente novamente.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="min-h-10 rounded px-2 text-xs text-secundary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        Estornar recebimento
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`reversal-${receiptId}`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[min(92vw,480px)] overflow-y-auto rounded-xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/65"
      >
        <form onSubmit={submit} className="space-y-5">
          <h2 id={`reversal-${receiptId}`} className="text-xl font-semibold">
            Estornar {formatMoney(amount)}?
          </h2>
          <p className="text-sm leading-6 text-secundary">
            O valor voltará ao saldo pendente. O recebimento original e o motivo
            ficarão no histórico. Este registro não realiza devoluções
            bancárias.
          </p>
          <FinanceField label="Motivo do estorno">
            <textarea
              autoFocus
              required
              minLength={3}
              maxLength={1000}
              name="reason"
              className={financeInput}
              disabled={busy}
            />
          </FinanceField>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              className={financeButton}
            >
              Cancelar
            </button>
            <button disabled={busy} className={financePrimary}>
              {busy ? "Estornando…" : "Confirmar estorno"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
