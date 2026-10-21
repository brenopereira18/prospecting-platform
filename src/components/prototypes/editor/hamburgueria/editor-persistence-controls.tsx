"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleDot,
  FilePlus2,
  History,
  LoaderCircle,
  Save,
} from "lucide-react";
import type { usePrototypePersistence } from "./use-prototype-persistence";

export function EditorPersistenceControls({
  id,
  persistence,
}: {
  id: string;
  persistence: ReturnType<typeof usePrototypePersistence>;
}) {
  const { status, busy, dirty, name, setName, revision } = persistence;
  const error = status.kind === "error" || status.kind === "conflict";
  const focus =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const button = `inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors sm:min-h-10 sm:px-3 disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;
  const StatusIcon = busy
    ? LoaderCircle
    : error
      ? CircleAlert
      : dirty
        ? CircleDot
        : Check;
  const message =
    status.kind === "saved" && dirty
      ? "O rascunho enviado foi salvo. Há novas alterações locais para salvar."
      : status.kind === "version-created" && dirty
        ? `${status.message} Há novas alterações locais para salvar.`
        : status.message ||
          (dirty ? "Alterações não salvas" : "Sem alterações pendentes");
  const detailedStatus =
    error ||
    Boolean(status.versionId) ||
    (dirty && (status.kind === "saved" || status.kind === "version-created"));
  const imageNotice = dirty && !busy && persistence.hasTemporaryImages;
  const statusIndicator = (
    <div
      role={error ? "alert" : "status"}
      aria-atomic="true"
      className={`col-span-3 flex min-w-0 items-start gap-2 text-xs ${error ? "text-red-300" : busy ? "text-primary" : dirty ? "text-amber-300" : "text-secundary"}`}
    >
      <StatusIcon
        size={14}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${busy ? "motion-safe:animate-spin" : ""}`}
      />
      <div className="min-w-0 break-words leading-5">
        {message}
        {status.kind === "conflict" && (
          <Link
            href={`/prototipos/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-2 rounded-sm underline underline-offset-2 ${focus}`}
          >
            Abrir rascunho salvo em outra aba
          </Link>
        )}
        {status.versionId && (
          <Link
            href={`/prototipos/${id}/versoes/${status.versionId}`}
            className={`ml-2 rounded-sm text-primary underline underline-offset-2 ${focus}`}
          >
            Visualizar versão
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <section
      aria-label="Identificação e salvamento do protótipo"
      className="shrink-0 border-b border-sidebar-hover bg-card px-4 py-3 sm:px-5"
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/prototipos"
            aria-label="Meus protótipos"
            title="Meus protótipos"
            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2 text-xs text-secundary hover:bg-sidebar-hover hover:text-foreground ${focus}`}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            <span className="sr-only xl:not-sr-only">Meus protótipos</span>
          </Link>
          <div
            className="h-8 w-px shrink-0 bg-sidebar-hover"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 lg:max-w-sm">
            <div className="mb-1 flex items-center justify-between gap-3 px-2">
              <label
                htmlFor="prototype-internal-name"
                className="text-[11px] text-secundary"
              >
                Nome interno
              </label>
              <span className="shrink-0 text-[11px] tabular-nums text-secundary">
                Revisão {revision}
              </span>
            </div>
            <input
              id="prototype-internal-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              className={`min-h-9 w-full min-w-0 rounded-md border border-sidebar-hover bg-background px-2 text-base font-medium text-foreground transition-colors hover:border-secundary/50 sm:text-sm ${focus}`}
            />
          </div>
        </div>

        <div
          role="group"
          aria-label="Histórico e ações do protótipo"
          aria-busy={busy}
          className="grid grid-cols-3 gap-2 lg:flex lg:items-center"
        >
          {!detailedStatus && statusIndicator}
          <Link
            href={`/prototipos/${id}/versoes`}
            aria-label="Ver versões"
            title="Ver versões"
            className={`${button} text-secundary hover:bg-sidebar-hover hover:text-foreground lg:mr-2`}
          >
            <History size={16} className="shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Ver versões</span>
            <span className="sm:hidden">Versões</span>
          </Link>
          <button
            type="button"
            aria-label="Criar versão"
            className={`${button} border border-sidebar-hover text-foreground enabled:hover:bg-sidebar-hover`}
            disabled={busy}
            onClick={persistence.createVersion}
          >
            {status.kind === "versioning" ? (
              <LoaderCircle
                size={16}
                className="hidden shrink-0 motion-safe:animate-spin sm:block"
                aria-hidden="true"
              />
            ) : (
              <FilePlus2
                size={16}
                className="hidden shrink-0 sm:block"
                aria-hidden="true"
              />
            )}
            Criar versão
          </button>
          <button
            type="button"
            aria-label="Salvar rascunho"
            className={`${button} bg-primary font-semibold text-background enabled:hover:bg-primary/90`}
            disabled={busy || !dirty}
            onClick={persistence.save}
          >
            {status.kind === "saving" ? (
              <LoaderCircle
                size={16}
                className="shrink-0 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save size={16} className="shrink-0" aria-hidden="true" />
            )}
            <span>
              Salvar<span className="hidden sm:inline"> rascunho</span>
            </span>
          </button>
        </div>
      </div>

      {(detailedStatus || imageNotice) && (
        <div className="mt-2.5 flex min-w-0 flex-col gap-2 text-xs lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          {detailedStatus && statusIndicator}
          {imageNotice && (
            <p className="max-w-md text-[11px] leading-5 text-secundary lg:text-right">
              As imagens usadas serão enviadas ao salvar. Criar versão também
              salva as alterações.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
