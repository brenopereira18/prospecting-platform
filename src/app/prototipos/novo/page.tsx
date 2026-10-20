import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { CreatePrototypeForm } from "@/src/components/prototypes/create-prototype-form";

export default async function NewPrototypePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  if (leadId !== undefined && !z.uuid().safeParse(leadId).success) notFound();
  return <main className="mx-auto max-w-3xl p-6 sm:p-10"><Link href="/prototipos" className="text-sm text-secundary underline">Voltar aos protótipos</Link><h1 className="mt-6 text-2xl font-semibold">Criar protótipo</h1><CreatePrototypeForm leadId={leadId} /></main>;
}
