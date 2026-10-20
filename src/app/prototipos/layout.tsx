import { requirePrototypeUser } from "./_data";

export const dynamic = "force-dynamic";
export default async function PrototypesLayout({ children }: { children: React.ReactNode }) {
  await requirePrototypeUser();
  return children;
}
