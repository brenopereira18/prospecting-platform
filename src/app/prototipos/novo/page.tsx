import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { requirePrototypeUser } from "../_data";

export default async function NewPrototypePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  await requirePrototypeUser();
  if (!leadId) redirect("/leads");
  if (!z.uuid().safeParse(leadId).success) notFound();
  redirect(`/leads/${leadId}/prototipos/novo`);
}
