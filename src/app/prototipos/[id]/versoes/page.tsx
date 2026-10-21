import { redirect } from "next/navigation";
import { loadPrototype } from "../../_data";
import { prototypeHistoryHref } from "@/src/components/prototypes/prototype-navigation";

export default async function PrototypeVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype } = await loadPrototype(id);
  redirect(prototypeHistoryHref(prototype));
}
