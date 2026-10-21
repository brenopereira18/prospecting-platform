"use client";

import Link from "next/link";
import type { usePrototypePersistence } from "./use-prototype-persistence";

export function EditorPersistenceControls({ id, persistence }: { id: string; persistence: ReturnType<typeof usePrototypePersistence> }) {
  const { status, busy, dirty, name, setName, revision } = persistence;
  const error = status.kind === "error" || status.kind === "conflict";
  const button = "min-h-9 rounded-lg border border-sidebar-hover px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 hover:bg-sidebar-hover";
  return <div className="flex shrink-0 flex-wrap items-center gap-3 overflow-y-auto border-b border-sidebar-hover bg-card px-5 py-3 max-md:max-h-[30dvh]">
    <Link href="/prototipos" className={button}>Meus protótipos</Link>
    <label className="flex items-center gap-2 text-xs">Nome interno
      <input value={name} maxLength={120} onChange={event => setName(event.target.value)} className="min-h-9 w-52 rounded-lg border border-sidebar-hover bg-background px-3 text-sm" />
    </label>
    <span className="text-xs text-secundary">Revisão {revision}</span>
    <button type="button" className={`${button} bg-primary text-background`} disabled={busy || !dirty} onClick={persistence.save}>Salvar rascunho</button>
    <button type="button" className={button} disabled={busy} onClick={persistence.createVersion}>Criar versão</button>
    <Link href={`/prototipos/${id}/versoes`} className={button}>Ver versões</Link>
    {dirty && !busy && <span className="text-xs text-secundary">As imagens usadas serão enviadas ao salvar. Criar versão também salva as alterações.</span>}
    {status.message && <div role={error ? "alert" : "status"} className={`w-full text-xs ${error ? "text-red-300" : "text-secundary"}`}>
      {status.kind === "saved" && dirty ? "O rascunho enviado foi salvo. Há novas alterações locais para salvar." : status.message}
      {status.kind === "conflict" && <Link href={`/prototipos/${id}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline">Abrir rascunho salvo em outra aba</Link>}
      {status.versionId && <Link href={`/prototipos/${id}/versoes/${status.versionId}`} className="ml-2 underline">Visualizar versão</Link>}
    </div>}
  </div>;
}
