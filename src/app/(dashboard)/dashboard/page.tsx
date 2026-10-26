import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../server/auth/current-user.service";
import { SummaryCard } from "../../../components/dashboard/summary-card";
import { Search } from "lucide-react";
import { FunnelCard } from "../../../components/dashboard/funnel-card";
import { LeadFunnelService } from "../../../server/leads/lead-funnel.service";
import { LeadMonthlyService } from "../../../server/leads/lead-monthly.service";
import { MonthlyPerformance } from "../../../components/dashboard/monthly-performance";
import { MonthlySalesService } from "../../../server/finance/monthly-sales.service";
import { prisma } from "@/lib/prisma/client";

import Link from "next/link";

export const dynamic = "force-dynamic";

const leadFunnelService = new LeadFunnelService();
const leadMonthlyService = new LeadMonthlyService();
const monthlySalesService = new MonthlySalesService(prisma);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { month } = await searchParams;
  const now = new Date();
  const [funnel, monthly, sales] = await Promise.all([
    leadFunnelService.getByUser(user.id),
    leadMonthlyService.getByUser(user.id, month, now),
    monthlySalesService.getByUser(user.id, month, now),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

            <p className="mt-1 text-sm text-secundary">
              Visão geral da sua operação de prospecção.
            </p>
          </div>

          <Link
            href="/descobrir-negocios"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:self-auto"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Descobrir negócios
          </Link>
        </header>

        <SummaryCard data={sales} />

        <MonthlyPerformance data={monthly} />
        <FunnelCard data={funnel} />
      </div>
    </main>
  );
}
