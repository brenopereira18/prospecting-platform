import Link from "next/link";
import { requirePrototypeUser } from "./_data";
import { prototypeService } from "@/src/server/prototypes/prototype.service";

export default async function PrototypesPage() {
  const user = await requirePrototypeUser();
  const prototypes = await prototypeService.list(user.id);
  return <main className="mx-auto max-w-5xl space-y-6 p-6 sm:p-10">
    <Link href="/dashboard" className="text-sm text-secundary underline">Voltar ao dashboard</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Meus protótipos</h1><Link href="/prototipos/novo" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-background">Criar protótipo</Link></div>
    {!prototypes.length && <p className="text-secundary">Você ainda não tem protótipos salvos.</p>}
    <ul className="space-y-3">{prototypes.map(prototype => <li key={prototype.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sidebar-hover bg-card p-5">
      <div><Link href={`/prototipos/${prototype.id}`} className="font-semibold underline">{prototype.name}</Link><p className="mt-2 text-xs text-secundary">{prototype.templateId} · Template {prototype.templateVersion} · Revisão {prototype.draftRevision}</p></div>
      <Link href={`/prototipos/${prototype.id}/versoes`} className="text-sm underline">Versões</Link>
    </li>)}</ul>
  </main>;
}
