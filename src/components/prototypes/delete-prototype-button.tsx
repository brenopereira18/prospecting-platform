"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePrototypeAction } from "@/src/app/actions/prototypes";

export function DeletePrototypeButton({ id, name, revision }: { id: string; name: string; revision: number }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <>
    <button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }} className="inline-flex items-center gap-1.5 text-red-300 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Excluir protótipo ${name}`}>
      <Trash2 size={15} aria-hidden="true" />Excluir
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { if (lock.current) event.preventDefault(); }} className="m-auto w-[calc(100%_-_32px)] max-w-md rounded-2xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60">
      <h2 id={titleId} className="text-lg font-semibold">Excluir protótipo?</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-secundary">O protótipo <strong className="break-words text-foreground">{name}</strong> e todas as suas versões serão excluídos permanentemente. O lead será mantido. Esta ação não pode ser desfeita.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="min-h-10 rounded-lg border border-sidebar-hover px-4 text-sm hover:bg-sidebar-hover disabled:opacity-50">Cancelar</button>
        <button type="button" disabled={pending} className="min-h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50" onClick={async () => {
          if (lock.current) return;
          lock.current = true; setPending(true); setError("");
          try {
            const result = await deletePrototypeAction({ id, expectedRevision: revision });
            if (!result.success) {
              setError(result.code === "CONFLICT" ? "O protótipo foi atualizado em outra aba. Feche esta janela e confira a revisão atual antes de excluir." : result.error);
              if (result.code === "CONFLICT" || result.code === "NOT_FOUND") router.refresh();
              return;
            }
            dialog.current?.close();
            router.refresh();
          } catch { setError("Não foi possível excluir o protótipo. Tente novamente."); }
          finally { lock.current = false; setPending(false); }
        }}>{pending ? "Excluindo…" : "Excluir definitivamente"}</button>
      </div>
    </dialog>
  </>;
}
