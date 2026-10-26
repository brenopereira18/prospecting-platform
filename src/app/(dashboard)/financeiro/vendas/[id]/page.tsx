import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  FinanceError,
  FinanceService,
} from "@/src/server/finance/finance.service";
import {
  moneyCents,
  centsMoney,
  formatProposalDate,
} from "@/src/server/proposals/proposal.schema";
import { FinanceTotals } from "@/src/components/finance/finance-ui";
import { ReceivableList } from "@/src/components/finance/receivable-card";
export default async function SalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sale = await new FinanceService(prisma).get(id, user.id).catch((e) => {
    if (e instanceof FinanceError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const received = sale.receivables.reduce(
    (sum, a) => sum + moneyCents(a.received),
    0,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:p-8">
      <Link
        href="/financeiro"
        className="inline-flex min-h-9 items-center rounded text-sm text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        Voltar ao financeiro
      </Link>
      <header>
        <h1 className="break-words text-2xl font-semibold">
          {sale.clientName}
        </h1>
        <p className="mt-2 break-words text-sm text-secundary">{sale.title}</p>
        <p className="mt-2 text-xs text-secundary">
          Venda de {formatProposalDate(sale.soldOn)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-9 items-center rounded text-sm text-secundary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            href={`/leads/${sale.leadId}?tab=proposals`}
          >
            Abrir lead
          </Link>
          <Link
            className="inline-flex min-h-9 items-center rounded text-sm text-secundary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            href={`/leads/${sale.leadId}/propostas/${sale.proposalId}`}
          >
            Proposta aceita
          </Link>
        </div>
      </header>
      <FinanceTotals
        scope="sale"
        sold={sale.total}
        received={centsMoney(received)}
        outstanding={centsMoney(moneyCents(sale.total) - received)}
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contas a receber</h2>
        <div className="overflow-hidden rounded-xl border border-sidebar-hover bg-card">
          <ReceivableList
            accounts={sale.receivables}
            title="Descrição / parcela"
          />
        </div>
      </section>
    </div>
  );
}
