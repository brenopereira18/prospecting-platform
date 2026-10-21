import Link from "next/link";
import { requirePrototypeUser } from "./_data";
import { prototypeService } from "@/src/server/prototypes/prototype.service";
import { DeletePrototypeButton } from "@/src/components/prototypes/delete-prototype-button";
import { prototypeHistoryHref } from "@/src/components/prototypes/prototype-navigation";
import { PrototypeVersionHistory } from "@/src/components/prototypes/prototype-version-history";

export default async function PrototypesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePrototypeUser();
  const prototypes = await prototypeService.list(user.id);
  const query = await searchParams ?? {};
  return <main className="mx-auto max-w-5xl space-y-6 p-6 sm:p-10">
    <Link href="/dashboard" className="text-sm text-secundary underline">Voltar ao dashboard</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Meus protótipos</h1><Link href="/leads" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-background">Gerar a partir de um lead</Link></div>
    {!prototypes.length && <p className="text-secundary">Você ainda não tem protótipos salvos.</p>}
    <ul className="space-y-3">{prototypes.map(prototype => <li id={`prototipo-${prototype.id}`} key={prototype.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sidebar-hover bg-card p-5">
      <div><Link href={`/prototipos/${prototype.id}`} className="font-semibold underline">{prototype.name}</Link><p className="mt-2 text-xs text-secundary">{prototype.templateId} · Template {prototype.templateVersion} · Revisão {prototype.draftRevision}</p>
        <p className="mt-2 text-sm">Estabelecimento: {prototype.businessName}</p>
        {prototype.leadId && prototype.leadName ? <Link href={`/leads/${prototype.leadId}`} className="mt-2 block text-sm text-primary underline">Lead: {prototype.leadName}</Link> : <p className="mt-2 text-xs text-secundary">Sem lead associado</p>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm"><Link className="underline" href={`/prototipos/${prototype.id}`}>Editar</Link><Link className="underline" href={`/prototipos/${prototype.id}/previa`}>Visualizar</Link><Link className="underline" href={prototypeHistoryHref(prototype)}>Versões</Link><DeletePrototypeButton id={prototype.id} name={prototype.name} revision={prototype.draftRevision} /></div>
      {!prototype.leadId && <div className="w-full"><PrototypeVersionHistory key={`${prototype.id}:${prototype.updatedAt}`} prototype={prototype} initiallyExpanded={query.prototype === prototype.id} /></div>}
    </li>)}</ul>
  </main>;
}
