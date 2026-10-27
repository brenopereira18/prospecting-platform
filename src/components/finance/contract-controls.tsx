"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  createContractAction,
  updateContractAction,
  contractStatusAction,
  generateMonthlyAction,
} from "@/src/app/actions/recurring";
import {
  contractKinds,
  kindLabels,
  statusLabels,
  type ContractTerms,
  type ContractResult,
} from "@/src/server/finance/recurring.schema";
import {
  FinanceField,
  financeInput,
  financeButton,
  financePrimary,
} from "./finance-ui";

// Only request/feedback state lives here. Commercial values remain in the form.
function useContractCommand() {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  async function run(
    operation: () => Promise<ContractResult>,
    message: string,
    navigate = false,
  ) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setFields({});
    try {
      const result = await operation();
      if (!result.success) {
        setError(result.error);
        setFields(result.fields ?? {});
        return false;
      }
      setSuccess(message);
      if (navigate) router.push(`/financeiro/contratos/${result.contractId}`);
      router.refresh();
      return true;
    } catch {
      setError("Não foi possível concluir. Seus dados foram mantidos.");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    fields,
    run,
    feedback: (
      <>
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
      </>
    ),
  };
}

export function ContractForm({
  saleId,
  today,
  initial,
}: {
  saleId: string;
  today: string;
  initial?: {
    id: string;
    revision: number;
    startsOn: string;
    terms: ContractTerms;
  };
}) {
  const command = useContractCommand();
  const requestId = useRef<string | null>(null);
  const terms = initial?.terms;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const values = {
      kind: data.kind,
      description: data.description,
      monthlyAmount: data.monthlyAmount,
      dueDay: Number(data.dueDay),
      paymentMethod: data.paymentMethod,
      notes: data.notes,
    };
    requestId.current ??= crypto.randomUUID();
    await command.run(
      () =>
        initial
          ? updateContractAction({
              id: initial.id,
              expectedRevision: initial.revision,
              terms: values,
            })
          : createContractAction({
              id: requestId.current,
              saleId,
              startsOn: data.startsOn,
              terms: values,
            }),
      initial
        ? "Condições atualizadas. Mensalidades existentes foram preservadas."
        : "Contrato cadastrado.",
      !initial,
    );
  }
  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      aria-label={
        initial ? "Editar condições do contrato" : "Cadastrar contrato"
      }
    >
      <fieldset disabled={command.busy} className="space-y-5">
        <legend className="sr-only">Serviço e condições de cobrança</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FinanceField
            label="Tipo de serviço"
            error={command.fields["terms.kind"]}
          >
            <select
              name="kind"
              aria-label="Tipo de serviço"
              className={financeInput}
              defaultValue={terms?.kind ?? "AMBOS"}
            >
              {contractKinds.map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k]}
                </option>
              ))}
            </select>
          </FinanceField>
          <FinanceField
            label="Valor mensal (R$)"
            error={command.fields["terms.monthlyAmount"]}
          >
            <input
              name="monthlyAmount"
              inputMode="decimal"
              required
              defaultValue={terms?.monthlyAmount.replace(".", ",")}
              className={financeInput}
            />
          </FinanceField>
        </div>
        <div
          className={`grid gap-4 ${initial ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_1fr_1.25fr]"}`}
        >
          {!initial && (
            <FinanceField
              label="Data de início"
              error={command.fields.startsOn}
            >
              <input
                name="startsOn"
                type="date"
                required
                defaultValue={today}
                className={financeInput}
              />
            </FinanceField>
          )}
          <FinanceField
            label="Dia do vencimento"
            error={command.fields["terms.dueDay"]}
          >
            <input
              name="dueDay"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={terms?.dueDay ?? 10}
              className={financeInput}
            />
          </FinanceField>
          <FinanceField
            label="Forma de pagamento prevista"
            error={command.fields["terms.paymentMethod"]}
          >
            <select
              name="paymentMethod"
              aria-label="Forma de pagamento prevista"
              defaultValue={terms?.paymentMethod ?? "PIX"}
              className={financeInput}
            >
              <option value="PIX">Pix</option>
              <option value="CARTAO">Cartão de crédito</option>
            </select>
          </FinanceField>
        </div>
        <div>
          <FinanceField
            label="Serviços incluídos"
            error={command.fields["terms.description"]}
          >
            <textarea
              name="description"
              rows={2}
              required
              minLength={3}
              maxLength={3000}
              defaultValue={terms?.description}
              className={financeInput}
            />
          </FinanceField>
        </div>
        <details
          open={Boolean(terms?.notes || command.fields["terms.notes"])}
          className="group/notes"
        >
          <summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            <ChevronDown
              aria-hidden
              className="size-3.5 group-open/notes:rotate-180"
            />
            Observações (opcional)
          </summary>
          <div className="pt-1">
            <FinanceField
              label="Observações"
              error={command.fields["terms.notes"]}
            >
              <textarea
                name="notes"
                rows={2}
                maxLength={3000}
                defaultValue={terms?.notes}
                className={financeInput}
              />
            </FinanceField>
          </div>
        </details>
      </fieldset>
      {initial && (
        <p className="text-xs leading-5 text-secundary">
          As alterações afetam apenas mensalidades ainda não geradas.
        </p>
      )}
      <div className="flex flex-col-reverse items-start gap-2 border-t border-sidebar-hover pt-4 sm:flex-row sm:items-center sm:justify-between">
        <details className="group/rules max-w-lg text-xs leading-5 text-secundary">
          <summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded underline decoration-sidebar-hover underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            <ChevronDown
              aria-hidden
              className="size-3.5 group-open/rules:rotate-180"
            />
            Regras das mensalidades
          </summary>
          <p className="pb-2">
            A geração é manual, sem cobrança automática. O primeiro mês tem
            valor integral e dias inexistentes vencem no último dia do mês.{" "}
            {initial && "Contas já geradas e recebimentos são preservados."}
          </p>
        </details>
        <button
          disabled={command.busy}
          className={`${financePrimary} w-full shrink-0 sm:w-auto`}
        >
          {command.busy
            ? "Salvando…"
            : initial
              ? "Salvar condições"
              : "Cadastrar contrato"}
        </button>
      </div>
      {command.feedback}
    </form>
  );
}

export function ContractStatusControl({
  id,
  revision,
  status,
}: {
  id: string;
  revision: number;
  status: keyof typeof statusLabels;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<keyof typeof statusLabels>("SUSPENSO");
  const command = useContractCommand();
  if (status === "CANCELADO") return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(status === "ATIVO"
          ? (["SUSPENSO", "CANCELADO"] as const)
          : (["ATIVO", "CANCELADO"] as const)
        ).map((next) => (
          <button
            key={next}
            className={
              next === "CANCELADO"
                ? "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                : financeButton
            }
            onClick={() => {
              setTarget(next);
              dialog.current?.showModal();
            }}
          >
            {next === "ATIVO"
              ? "Reativar"
              : next === "SUSPENSO"
                ? "Suspender"
                : "Cancelar contrato"}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="contract-status-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60"
        onCancel={(event) => {
          if (command.busy) event.preventDefault();
        }}
      >
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get("reason");
            if (
              await command.run(
                () =>
                  contractStatusAction({
                    id,
                    expectedRevision: revision,
                    status: target,
                    reason,
                  }),
                "Estado atualizado.",
              )
            )
              dialog.current?.close();
          }}
        >
          <h2 id="contract-status-title" className="text-lg font-semibold">
            {target === "ATIVO"
              ? "Reativar contrato?"
              : target === "SUSPENSO"
                ? "Suspender contrato?"
                : "Cancelar contrato?"}
          </h2>
          <p className="text-sm leading-6 text-secundary">
            {target === "ATIVO"
              ? "A geração poderá ser retomada nesta competência."
              : "Novas mensalidades ficam bloqueadas nesta competência e nas seguintes."}{" "}
            Contas já geradas e recebimentos serão preservados.
            {target === "CANCELADO" && " O cancelamento é definitivo."}
          </p>
          <FinanceField label="Motivo" error={command.fields.reason}>
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              className={financeInput}
              disabled={command.busy}
            />
          </FinanceField>
          {command.feedback}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={command.busy}
              className={financeButton}
              onClick={() => dialog.current?.close()}
            >
              Voltar
            </button>
            <button
              disabled={command.busy}
              className={
                target === "CANCELADO"
                  ? `${financeButton} border-transparent bg-red-700 text-white hover:bg-red-800`
                  : financePrimary
              }
            >
              {command.busy
                ? "Confirmando…"
                : target === "ATIVO"
                  ? "Reativar contrato"
                  : target === "SUSPENSO"
                    ? "Suspender contrato"
                    : "Cancelar contrato"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function GenerateMonthly({
  id,
  revision,
  startsOn,
  today,
}: {
  id: string;
  revision: number;
  startsOn: string;
  today: string;
}) {
  const command = useContractCommand();
  const competenceId = useId();
  return (
    <form
      aria-label="Gerar mensalidade"
      onSubmit={async (event) => {
        event.preventDefault();
        const competence = new FormData(event.currentTarget).get("competence");
        await command.run(
          () =>
            generateMonthlyAction({
              id,
              expectedRevision: revision,
              competence,
            }),
          "Mensalidade disponível. Competências já geradas são reutilizadas.",
        );
      }}
      className="space-y-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Mensalidades</h2>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:w-auto sm:grid-cols-[11rem_auto]">
          <label htmlFor={competenceId} className="sr-only">
            Competência
          </label>
          <input
            id={competenceId}
            name="competence"
            type="month"
            min={startsOn.slice(0, 7)}
            max={today.slice(0, 7)}
            defaultValue={today.slice(0, 7)}
            required
            disabled={command.busy}
            aria-invalid={Boolean(command.fields.competence)}
            aria-describedby={
              command.fields.competence ? `${competenceId}-error` : undefined
            }
            className={financeInput.replace("mt-2 ", "")}
          />
          <button
            aria-label="Gerar mensalidade"
            className={financePrimary}
            disabled={command.busy}
          >
            {command.busy ? (
              "Gerando…"
            ) : (
              <>
                <span className="sm:hidden">Gerar</span>
                <span className="hidden sm:inline">Gerar mensalidade</span>
              </>
            )}
          </button>
          {command.fields.competence && (
            <p
              id={`${competenceId}-error`}
              role="alert"
              className="col-span-2 text-xs text-red-300"
            >
              {command.fields.competence}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-secundary">
        Geração manual. O pagamento é registrado separadamente.
      </p>
      {command.feedback}
    </form>
  );
}
