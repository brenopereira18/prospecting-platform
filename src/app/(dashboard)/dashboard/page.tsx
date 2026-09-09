import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../server/auth/current-user.service";
import { logoutAction } from "../../actions/auth";
import { SummaryCard } from "../../../components/dashboard/summary-card";
import { Search } from "lucide-react";
import { FunnelCard } from "../../../components/dashboard/funnel-card";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <header className="flex mb-6 items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

            <p className="mt-1 text-sm text-secundary">
              Visão geral da sua operação de prospecção.
            </p>
          </div>

          <button
            type="button"
            className="flex items-center gap-3 rounded-md bg-primary px-4 py-2.5 text-sm text-terciary transition-opacity hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Descobrir negócios
          </button>
        </header>

        <SummaryCard />

        <FunnelCard />
      </div>
    </main>
  );
}
