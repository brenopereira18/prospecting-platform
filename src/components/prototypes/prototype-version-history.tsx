"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Eye,
  History,
  LoaderCircle,
  Copy,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  deletePrototypeVersionAction,
  listPrototypeVersionsAction,
  restorePrototypeVersionAction,
} from "@/src/app/actions/prototypes";
import type {
  PrototypeSummaryDTO,
  PrototypeVersionSummaryDTO,
} from "@/src/server/prototypes/prototype.dto";

type Selection = {
  kind: "restore" | "delete";
  version: PrototypeVersionSummaryDTO;
};
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const button = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;

export function PrototypeVersionList({
  prototypeId,
  versions,
  disabled,
  onAction,
}: {
  prototypeId: string;
  versions: PrototypeVersionSummaryDTO[];
  disabled: boolean;
  onAction: (selection: Selection) => void;
}) {
  const ownVersions = versions
    .filter((version) => version.prototypeId === prototypeId)
    .toSorted((a, b) => b.number - a.number);
  if (!ownVersions.length)
    return (
      <p className="px-4 py-6 text-sm leading-relaxed text-secundary">
        Nenhuma versão criada. No editor, use “Criar versão” para guardar um
        snapshot do protótipo.
      </p>
    );
  return (
    <ul className="max-h-96 divide-y divide-sidebar-hover overflow-y-auto overscroll-contain">
      {ownVersions.map((version) => (
        <li
          key={version.id}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Versão {version.number}</p>
            <time
              dateTime={version.createdAt}
              className="mt-1 block text-xs text-secundary"
            >
              {new Date(version.createdAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Sao_Paulo",
              })}
            </time>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Link
              href={`/prototipos/${prototypeId}/versoes/${version.id}`}
              className={`${button} text-primary hover:bg-primary/10`}
              aria-label={`Visualizar versão ${version.number}`}
            >
              <Eye size={14} aria-hidden="true" />
              Visualizar
            </Link>
            <button
              type="button"
              disabled={disabled}
              className={`${button} text-foreground hover:bg-sidebar-hover`}
              aria-label={`Usar versão ${version.number} como base`}
              title={`Usar versão ${version.number} como base`}
              onClick={() => onAction({ kind: "restore", version })}
            >
              <Copy size={14} aria-hidden="true" />
              Usar como base
            </button>
            <button
              type="button"
              disabled={disabled}
              className={`${button} text-red-300 hover:bg-red-400/10`}
              aria-label={`Excluir versão ${version.number}`}
              onClick={() => onAction({ kind: "delete", version })}
            >
              <Trash2 size={14} aria-hidden="true" />
              Excluir
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PrototypeVersionConfirmation({
  dialogRef,
  prototype,
  selection,
  pending,
  error,
  onConfirm,
  onRefresh,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  prototype: Pick<PrototypeSummaryDTO, "name">;
  selection: Selection | null;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onRefresh: () => void;
}) {
  const title = useId(),
    description = useId();
  const restoring = selection?.kind === "restore";
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_32px)] max-w-md overflow-y-auto rounded-2xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60"
    >
      <h3 id={title} className="text-lg font-semibold">
        {restoring
          ? `Usar versão ${selection.version.number} como base?`
          : `Excluir versão ${selection?.version.number ?? ""}?`}
      </h3>
      <p className="mt-2 break-words text-sm font-medium text-primary">
        {prototype.name}
      </p>
      <div id={description} className="mt-4 space-y-3 text-sm leading-relaxed text-secundary">
        {restoring ? (
          <>
            <p>
              O rascunho atual será substituído pelo conteúdo desta versão. A
              versão {selection.version.number} continuará preservada no
              histórico. Você poderá editar o rascunho e criar uma nova versão
              depois.
            </p>
            <p className="text-xs">
              Alterações não salvas em outras abas não serão incorporadas.
            </p>
          </>
        ) : (
          <p>
            Somente esta versão será excluída permanentemente. O rascunho, as
            demais versões e as imagens armazenadas serão mantidos. Esta ação
            não pode ser desfeita.
          </p>
        )}
      </div>
      {error && (
        <div className="mt-4 space-y-2">
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onRefresh}
            className={`${button} border border-sidebar-hover`}
          >
            Atualizar dados
          </button>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          className={`${button} border border-sidebar-hover hover:bg-sidebar-hover`}
          onClick={() => dialogRef.current?.close()}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending || !selection}
          onClick={onConfirm}
          className={`${button} ${restoring ? "bg-primary text-background hover:opacity-90" : "bg-red-600 text-white hover:bg-red-500"}`}
        >
          {pending && (
            <LoaderCircle
              size={14}
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending
            ? restoring
              ? "Usando como base…"
              : "Excluindo…"
            : restoring
              ? "Usar como base"
              : "Excluir versão"}
        </button>
      </div>
    </dialog>
  );
}

export function PrototypeVersionHistory({
  prototype,
  initiallyExpanded = false,
}: {
  prototype: PrototypeSummaryDTO;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [versions, setVersions] = useState<PrototypeVersionSummaryDTO[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    inFlight = useRef(false);
  const summaryRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const versionCount =
    versions === null
      ? prototype.versionCount
      : versions.filter((version) => version.prototypeId === prototype.id)
          .length;

  useEffect(() => {
    if (!expanded || versions !== null) return;
    let active = true;
    listPrototypeVersionsAction(prototype.id)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setLoadError("");
          setVersions(result.data);
        }
        else setLoadError(result.error);
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Não foi possível carregar as versões. Tente novamente.",
          );
      });
    return () => {
      active = false;
    };
  }, [expanded, prototype.id, versions, attempt]);

  function reload() {
    setLoadError("");
    setVersions(null);
    setAttempt((value) => value + 1);
  }

  async function confirm() {
    if (!selection || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const input = {
        id: prototype.id,
        versionId: selection.version.id,
        confirmed: true,
      };
      if (selection.kind === "restore") {
        const result = await restorePrototypeVersionAction({
          ...input,
          expectedRevision: prototype.draftRevision,
        });
        if (!result.success) {
          setError(
            result.code === "CONFLICT"
              ? "O rascunho foi atualizado em outra aba. Atualize os dados e confira a revisão antes de substituir."
              : result.error,
          );
          return;
        }
        dialog.current?.close();
        router.push(`/prototipos/${result.data.id}`);
      } else {
        const result = await deletePrototypeVersionAction(input);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setVersions(
          (current) =>
            current?.filter((version) => version.id !== result.data.id) ?? null,
        );
        dialog.current?.close();
        setSuccess(`Versão ${selection.version.number} excluída.`);
        summaryRef.current?.focus();
      }
    } catch {
      setError(
        "Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
        className="group border-t border-sidebar-hover bg-background/30"
      >
        <summary
          ref={summaryRef}
          className={`flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-b-xl px-4 text-sm text-secundary hover:text-foreground [&::-webkit-details-marker]:hidden ${focus}`}
        >
          <History size={16} aria-hidden="true" />
          Histórico de versões
          {versionCount !== undefined && (
            <span className="text-xs tabular-nums">
              {versionCount} {versionCount === 1 ? "versão" : "versões"}
            </span>
          )}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="ml-auto group-open:rotate-180"
          />
        </summary>
        {expanded && (
          <div
            aria-busy={versions === null && !loadError}
            className="border-t border-sidebar-hover"
          >
            <p className="px-4 pt-3 text-xs leading-relaxed text-secundary">
              As versões anteriores são preservadas. Você pode visualizá-las ou
              utilizá-las como base para novas alterações.
            </p>
            {versions === null && !loadError && (
              <p
                role="status"
                className="flex items-center gap-2 px-4 py-6 text-sm text-secundary"
              >
                <LoaderCircle
                  size={15}
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Carregando versões…
              </p>
            )}
            {loadError && (
              <div className="space-y-2 p-4">
                <p role="alert" className="text-sm text-red-300">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={reload}
                  className={`${button} border border-sidebar-hover`}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {versions !== null && (
              <PrototypeVersionList
                prototypeId={prototype.id}
                versions={versions}
                disabled={pending}
                onAction={(value) => {
                  setSelection(value);
                  setError("");
                  dialog.current?.showModal();
                }}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-hover px-4 py-2">
              <p role="status" className="text-xs text-primary">
                {success}
              </p>
              <button
                type="button"
                disabled={pending || (versions === null && !loadError)}
                onClick={reload}
                className={`${button} text-secundary hover:bg-sidebar-hover`}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Atualizar histórico
              </button>
            </div>
          </div>
        )}
      </details>
      <PrototypeVersionConfirmation
        dialogRef={dialog}
        prototype={prototype}
        selection={selection}
        pending={pending}
        error={error}
        onConfirm={confirm}
        onRefresh={() => {
          dialog.current?.close();
          reload();
          router.refresh();
        }}
      />
    </>
  );
}
