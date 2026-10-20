import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { prototypeService, PrototypeError } from "@/src/server/prototypes/prototype.service";

export async function requirePrototypeUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
export async function loadPrototype(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requirePrototypeUser();
  try { return { user, prototype: await prototypeService.findById(id, user.id) }; }
  catch (cause) { if (cause instanceof PrototypeError && cause.code === "NOT_FOUND") notFound(); throw cause; }
}
