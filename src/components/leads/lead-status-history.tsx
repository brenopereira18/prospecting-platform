import { ArrowRight, History } from "lucide-react";
import { LEAD_STATUS_LABELS } from "../../constants/lead-status";
import type { LeadStatusHistoryDTO } from "../../server/leads/lead-status.schema";

const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function LeadStatusHistory({
  entries,
}: {
  entries: LeadStatusHistoryDTO[];
}) {
  return (
    <details className="border-t border-sidebar-hover">
      <summary className="min-h-12 cursor-pointer rounded-b-xl px-6 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-7">
        <span className="ml-2 inline-flex items-center gap-2">
          <History size={16} aria-hidden="true" />
          Histórico comercial{" "}
          <span className="text-xs tabular-nums text-secundary">
            ({entries.length})
          </span>
        </span>
      </summary>
      <div className="px-6 py-4 sm:px-7">
        {entries.length === 0 ? (
          <p className="text-sm leading-6 text-secundary">
            Nenhuma mudança de status registrada. O status atual foi preservado;
            a data de entrada nessa etapa não está registrada.
          </p>
        ) : (
          <ol
            className="relative ml-1 space-y-5 before:absolute before:inset-y-2 before:left-[5px] before:w-px before:bg-sidebar-hover"
            aria-label="Mudanças de status, mais recentes primeiro"
          >
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className="relative grid gap-1 pl-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5"
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 left-0 z-10 size-3 rounded-full border-2 ${
                    index === 0
                      ? "border-primary bg-primary"
                      : "border-sidebar-hover bg-card"
                  }`}
                />
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-secundary">
                    {LEAD_STATUS_LABELS[entry.fromStatus]}
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="text-secundary"
                  />
                  <span className="sr-only">para</span>
                  <span className="font-semibold text-foreground">
                    {LEAD_STATUS_LABELS[entry.toStatus]}
                  </span>
                </p>
                <time
                  dateTime={entry.occurredAt}
                  className="text-xs tabular-nums text-secundary sm:text-right"
                >
                  {date
                    .format(new Date(entry.occurredAt))
                    .replace(", ", " às ")}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
