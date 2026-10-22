"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import type { LeadStatus } from "../../../generated/prisma/enums";
import { LEAD_STATUS_OPTIONS } from "../../constants/lead-status";
import { changeLeadStatusAction } from "../../app/(dashboard)/leads/[id]/actions";

export function LeadStatusControl({
  leadId,
  status,
  statusRevision,
}: {
  leadId: string;
  status: LeadStatus;
  statusRevision: number;
}) {
  const id = useId();
  const router = useRouter();
  const [selection, setSelection] = useState({
    value: status,
    revision: statusRevision,
  });
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
    reload?: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const lock = useRef(false);
  // A refreshed server revision invalidates an old selection without resetting
  // the form in an effect or resubmitting it automatically.
  const selected =
    selection.revision === statusRevision ? selection.value : status;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || selected === status) return;
    lock.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await changeLeadStatusAction({
          leadId,
          status: selected,
          expectedRevision: statusRevision,
        });
        if (!result.success) {
          setFeedback({
            error: true,
            message: result.error,
            reload: result.code === "CONFLICT" || result.code === "ERROR",
          });
          return;
        }
        setFeedback({
          error: false,
          message: result.data.changed
            ? "Status comercial atualizado."
            : "O lead já está neste status.",
        });
        router.refresh();
      } catch {
        setFeedback({
          error: true,
          message:
            "Não foi possível confirmar a alteração. Atualize o status antes de tentar novamente.",
          reload: true,
        });
      } finally {
        lock.current = false;
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Alterar status comercial"
      aria-busy={pending}
      className="space-y-3"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label
            htmlFor={id}
            className="block text-xs font-medium text-secundary"
          >
            Status comercial
          </label>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <select
            id={id}
            value={selected}
            disabled={pending}
            onChange={(event) => {
              setSelection({
                value: event.target.value as LeadStatus,
                revision: statusRevision,
              });
              setFeedback(null);
            }}
            className="min-h-11 w-full min-w-0 rounded-lg border border-sidebar-hover bg-background px-3 text-sm text-foreground [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 sm:w-52"
          >
            {LEAD_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(selected !== status || pending) && (
            <button
              type="submit"
              disabled={
                pending || selected === status || Boolean(feedback?.reload)
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-background hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <LoaderCircle
                  size={14}
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {pending ? "Salvando…" : "Salvar alteração"}
            </button>
          )}
        </div>
      </div>
      {feedback && (
        <div
          role={feedback.error ? "alert" : "status"}
          className={
            feedback.error ? "text-xs leading-5 text-red-300" : "sr-only"
          }
        >
          {feedback.message}
          {feedback.reload && (
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                router.refresh();
              }}
              className="ml-2 rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Atualizar status
            </button>
          )}
        </div>
      )}
    </form>
  );
}
