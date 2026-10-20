"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPrototypeAction } from "@/src/app/actions/prototypes";
import { brasaBurgerDefaultDocument } from "./templates/hamburgueria/data/default-document";

export function CreatePrototypeForm({ leadId }: { leadId?: string }) {
  const [name, setName] = useState("Novo protótipo de hamburgueria");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const router = useRouter();
  return <form className="mt-6 max-w-lg space-y-5" onSubmit={async event => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try {
      const result = await createPrototypeAction({ name, leadId, document: brasaBurgerDefaultDocument });
      if (!result.success) { setError(result.error); return; }
      router.push(`/prototipos/${result.data.id}`);
    } catch { setError("Não foi possível criar o protótipo. Tente novamente."); }
    finally { lock.current = false; setPending(false); }
  }}>
    <label className="block space-y-2 text-sm">Nome interno<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="block min-h-11 w-full rounded-lg border border-sidebar-hover bg-card px-3" /></label>
    <p className="text-sm text-secundary">Template Hamburgueria · Brasa Burger. O conteúdo poderá ser personalizado no editor.</p>
    {leadId && <p className="text-sm text-secundary">O protótipo será vinculado ao lead informado, após verificar sua conta.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button disabled={pending} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Criando…" : "Criar e abrir editor"}</button>
  </form>;
}
