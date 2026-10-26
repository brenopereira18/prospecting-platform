"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  changeProposalStatusAction,
  deleteProposalAction,
  duplicateProposalAction,
} from "@/src/app/actions/proposals";
import {
  nextStatuses,
  statusLabels,
  type ProposalDTO,
  type ProposalStatus,
} from "@/src/server/proposals/proposal.schema";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sidebar-hover px-3 text-sm font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";
export function ProposalActions({
  proposal,
  compact = false,
  saleId,
  leadWon = false,
}: {
  proposal: ProposalDTO;
  compact?: boolean;
  saleId?: string;
  leadWon?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const moreActions = useRef<HTMLDetailsElement>(null);
  const [operation, setOperation] = useState<"delete" | "status">("status");
  const [status, setStatus] = useState<ProposalStatus>(proposal.status);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const duplicateId = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const command = {
    id: proposal.id,
    leadId: proposal.leadId,
    expectedRevision: proposal.revision,
  };
  const path = `/leads/${proposal.leadId}/propostas/${proposal.id}`;
  const editable =
    proposal.status === "RASCUNHO" && !proposal.lockedAt && !proposal.deletedAt;
  const primaryAction = saleId
    ? { label: "Abrir venda", href: `/financeiro/vendas/${saleId}` }
    : proposal.status === "ACEITA" && leadWon && !proposal.deletedAt
      ? {
          label: "Registrar venda",
          href: `/financeiro/vendas/nova?lead=${proposal.leadId}&proposal=${proposal.id}`,
        }
      : editable
        ? { label: "Editar proposta", href: `${path}?edit=1` }
        : { label: "Abrir proposta", href: path };
  function closeMoreActions() {
    if (moreActions.current) moreActions.current.open = false;
  }
  function confirm(kind: "delete" | "status") {
    closeMoreActions();
    setOperation(kind);
    setError("");
    setDialogOpen(true);
    dialog.current?.showModal();
  }
  async function run(kind: "delete" | "status" | "duplicate") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      duplicateId.current ??= crypto.randomUUID();
      const result =
        kind === "delete"
          ? await deleteProposalAction(command)
          : kind === "status"
            ? await changeProposalStatusAction({ ...command, status })
            : await duplicateProposalAction({
                ...command,
                newId: duplicateId.current,
              });
      if (!result.success) {
        setError(result.error);
        return;
      }
      dialog.current?.close();
      if (kind === "duplicate")
        router.push(
          `/leads/${proposal.leadId}/propostas/${result.data.id}?edit=1`,
        );
      else if (kind === "delete")
        router.push(`/leads/${proposal.leadId}?tab=proposals`);
      else {
        setMessage("Status atualizado.");
        setStatus(result.data.status);
      }
      router.refresh();
    } catch {
      setError("Não foi possível concluir. Tente novamente.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/propostas/${proposal.id}/pdf`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Não foi possível gerar o PDF.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `proposta-${proposal.id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível baixar o PDF.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {compact ? (
        <div className="flex items-center gap-1.5" aria-busy={busy}>
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="truncate">{primaryAction.label}</span>
          </Link>
          <button
            type="button"
            aria-label="Baixar PDF"
            title="Baixar PDF"
            disabled={busy}
            onClick={download}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-medium text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <Download aria-hidden className="size-3.5" />
            <span>{busy ? "…" : "PDF"}</span>
          </button>
          <details
            ref={moreActions}
            className="relative shrink-0"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeMoreActions();
                moreActions.current?.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                closeMoreActions();
            }}
          >
            <summary
              aria-label={`Mais ações da proposta ${proposal.title}`}
              title="Mais ações"
              className="flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded text-secundary hover:bg-sidebar-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal aria-hidden className="size-5" />
            </summary>
            <div className="absolute right-0 bottom-full z-20 mb-2 w-56 rounded-lg border border-sidebar-hover bg-card p-1 shadow-lg">
              {primaryAction.href !== path && (
                <Link
                  href={path}
                  onClick={closeMoreActions}
                  className="flex min-h-10 items-center rounded px-3 text-sm hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Abrir proposta
                </Link>
              )}
              {!proposal.deletedAt && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    closeMoreActions();
                    void run("duplicate");
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  <Copy aria-hidden className="size-4" />
                  Duplicar como rascunho
                </button>
              )}
              {!proposal.deletedAt && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Excluir proposta ${proposal.title}`}
                  onClick={() => confirm("delete")}
                  className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm text-red-300 hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  <Trash2 aria-hidden className="size-4" />
                  Excluir proposta
                </button>
              )}
            </div>
          </details>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2" aria-busy={busy}>
          {!proposal.deletedAt && (
            <>
              {proposal.status === "RASCUNHO" && !proposal.lockedAt && (
                <Link className={button} href={`${path}?edit=1`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Editar
                </Link>
              )}
              {!compact && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => run("duplicate")}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  Duplicar como rascunho
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={download}
          >
            <Download className="size-4" aria-hidden="true" />
            {busy ? "Aguarde…" : "Baixar PDF"}
          </button>
          {!proposal.deletedAt && (
            <button
              type="button"
              className={`${button} text-red-300`}
              disabled={busy}
              onClick={() => confirm("delete")}
              aria-label={`Excluir proposta ${proposal.title}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>Excluir</span>
            </button>
          )}
        </div>
      )}
      {!compact &&
        !proposal.deletedAt &&
        nextStatuses[proposal.status].length > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t border-sidebar-hover pt-4">
            <label className="text-xs text-secundary">
              Status da proposta
              <select
                aria-label="Status da proposta"
                className="mt-2 block min-h-10 rounded-lg border border-sidebar-hover bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                value={status}
                disabled={busy}
                onChange={(event) =>
                  setStatus(event.target.value as ProposalStatus)
                }
              >
                {[proposal.status, ...nextStatuses[proposal.status]].map(
                  (value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              className={button}
              disabled={busy || status === proposal.status}
              onClick={() => confirm("status")}
            >
              Atualizar status
            </button>
          </div>
        )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {error && !dialogOpen && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        onClose={() => {
          setDialogOpen(false);
          if (compact) moreActions.current?.querySelector("summary")?.focus();
        }}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        aria-labelledby={`confirm-${proposal.id}`}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-sidebar-hover bg-card p-6 text-foreground shadow-xl backdrop:bg-black/65"
      >
        <h2 id={`confirm-${proposal.id}`} className="text-lg font-semibold">
          {operation === "delete"
            ? "Excluir esta proposta?"
            : `Marcar como ${statusLabels[status].toLowerCase()}?`}
        </h2>
        <p className="mt-3 text-sm leading-6 text-secundary">
          {operation === "delete"
            ? "A proposta sairá da listagem. Seu conteúdo e histórico comercial serão preservados."
            : status === "ENVIADA"
              ? "O conteúdo ficará preservado. Para alterar a oferta depois, duplique como rascunho. Esta ação apenas registra o envio; nenhum documento será enviado automaticamente."
              : status === "ACEITA"
                ? "A aceitação será registrada. Isso não significa que o pagamento foi recebido."
                : "A mudança será registrada no histórico da proposta."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            className={button}
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            className={`${button} ${operation === "delete" ? "text-red-300" : "bg-primary text-background"}`}
            onClick={() => run(operation)}
          >
            {busy
              ? "Aguarde…"
              : operation === "delete"
                ? "Excluir proposta"
                : "Confirmar status"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
