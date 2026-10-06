import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../server/auth/current-user.service";
import { logoutAction } from "../../actions/auth";
import { SummaryCard } from "../../../components/dashboard/summary-card";
import { Search } from "lucide-react";
import { FunnelCard } from "../../../components/dashboard/funnel-card";

import Link from "next/link";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

            <p className="mt-1 text-sm text-secundary">
              Visão geral da sua operação de prospecção.
            </p>
          </div>

          <Link
            href="/descobrir-negocios"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Descobrir negócios
          </Link>
        </header>

        <SummaryCard />

        <FunnelCard />
      </div>
    </main>
  );
}
