"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { saveMonthlySalesGoalAction } from "../../app/actions/monthly-sales";
import type { SaveMonthlyGoalResult } from "../../server/finance/monthly-sales.schema";
import {
  financeInput,
  financePrimary,
  financeButton,
} from "../finance/finance-ui";

export function MonthlyGoalForm({
  month,
  label,
  amount,
}: {
  month: string;
  label: string;
  amount: string | null;
}) {
  const id = useId();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<SaveMonthlyGoalResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldError =
    feedback && !feedback.success ? feedback.fields?.amount : undefined;

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await saveMonthlySalesGoalAction({
          month,
          amount: value,
        });
        setFeedback(result);
        if (result.success) {
          close();
          router.refresh();
        }
      } catch {
        setFeedback({
          success: false,
          error: "Não foi possível salvar a meta. Tente novamente.",
        });
      } finally {
        lock.current = false;
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Meta de vendas</h3>
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-disabled={pending}
          onClick={() => {
            if (pending) return;
            if (!open) {
              setValue(amount?.replace(".", ",") ?? "");
              setFeedback(null);
            }
            setOpen(!open);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current aria-disabled:opacity-60"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          {amount === null ? "Definir meta" : "Editar meta"}
        </button>
      </div>
      {open && (
        <form
          id={id}
          onSubmit={submit}
          aria-label={`Meta de vendas de ${label}`}
          aria-busy={pending}
          className="mb-4 mt-2 rounded-lg bg-card p-4 text-foreground"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              close();
            }
          }}
        >
          <label htmlFor={`${id}-amount`} className="text-sm font-medium">
            Meta de {label} (R$)
          </label>
          <input
            id={`${id}-amount`}
            autoFocus
            inputMode="decimal"
            type="text"
            required
            maxLength={13}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? `${id}-error` : undefined}
            className={financeInput}
            placeholder="Ex.: 5000,00"
          />
          {fieldError && (
            <p id={`${id}-error`} className="mt-2 text-xs text-red-300">
              {fieldError}
            </p>
          )}
          {feedback && !feedback.success && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {feedback.error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={financeButton}
              disabled={pending}
              onClick={close}
            >
              Cancelar
            </button>
            <button type="submit" className={financePrimary} disabled={pending}>
              {pending ? "Salvando…" : "Salvar meta"}
            </button>
          </div>
        </form>
      )}
      {feedback?.success && (
        <p role="status" className="mb-2 text-xs">
          Meta salva.
        </p>
      )}
    </div>
  );
}
