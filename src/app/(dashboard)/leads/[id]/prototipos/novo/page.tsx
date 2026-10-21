import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CreatePrototypeForm } from "@/src/components/prototypes/create-prototype-form";
import { requirePrototypeUser } from "@/src/app/prototipos/_data";
import { PrototypeError, prototypeService } from "@/src/server/prototypes/prototype.service";

export default async function LeadPrototypeConfigurationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePrototypeUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let options;
  try { options = await prototypeService.leadCreationOptions(id, user.id); }
  catch (cause) { if (cause instanceof PrototypeError && cause.code === "NOT_FOUND") notFound(); throw cause; }
  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
    <Link href={`/leads/${id}`} className="inline-flex min-h-10 items-center text-sm text-secundary underline">Voltar ao lead</Link>
    <header className="mt-4 space-y-3">
      <p className="text-xs font-semibold tracking-wide text-primary">NOVO PROTÓTIPO</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Configure a página de {options.lead.name}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-secundary">Confira os dados conhecidos e complemente as informações do estabelecimento. O protótipo será criado somente ao confirmar o formulário.</p>
    </header>
    <CreatePrototypeForm options={options} />
  </main>;
}
