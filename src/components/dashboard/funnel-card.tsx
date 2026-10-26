import type { LeadCommercialFunnelDTO } from "../../server/leads/lead.dto";

const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

function FunnelBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percentage =
    total > 0 ? Math.min(100, Math.max(0, (count / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-secundary">
          {number.format(count)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${number.format(count)} de ${number.format(total)} leads cadastrados`}
        className="relative h-2 overflow-hidden rounded-full bg-sidebar-hover"
      >
        <div
          style={{ width: `${percentage}%` }}
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
        />
      </div>
    </div>
  );
}

export function FunnelCard({ data }: { data: LeadCommercialFunnelDTO }) {
  return (
    <section
      aria-labelledby="commercial-funnel-title"
      className="mt-6 rounded-xl border border-sidebar-hover bg-card text-foreground"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="commercial-funnel-title"
              className="text-base font-semibold"
            >
              Situação atual dos leads
            </h2>
            <p className="mt-1 text-xs text-secundary">Todos os períodos.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-secundary">Total de leads</span>
            <span className="font-semibold tabular-nums">
              {number.format(data.total)}
            </span>
          </div>
        </div>
        {data.total === 0 && (
          <p className="mb-5 text-xs text-secundary">
            Nenhum lead cadastrado ainda.
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          <div role="group" aria-label="Em andamento" className="space-y-3.5">
            <h3 className="text-xs font-medium text-secundary">Em andamento</h3>
            <FunnelBar
              label="Ainda não abordados"
              count={data.counts.NOVO}
              total={data.total}
            />
            <FunnelBar
              label="Propostas enviadas"
              count={data.counts.PROPOSTA_ENVIADA}
              total={data.total}
            />
          </div>
          <div
            role="group"
            aria-label="Resultados"
            className="space-y-3.5 border-t border-sidebar-hover pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6"
          >
            <h3 className="text-xs font-medium text-secundary">Resultados</h3>
            <FunnelBar
              label="Ganhos"
              count={data.counts.GANHO}
              total={data.total}
            />
            <FunnelBar
              label="Perdidos"
              count={data.counts.PERDIDO}
              total={data.total}
            />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-sidebar-hover pt-4">
          <div>
            <p className="text-sm text-secundary">Taxa de conversão</p>
            <p className="mt-1 text-xs text-secundary">
              Leads ganhos ÷ total de leads cadastrados.
            </p>
          </div>
          <span className="text-xl font-semibold tabular-nums">
            {percent.format(data.conversionRate / 100)}
          </span>
        </div>
      </div>
    </section>
  );
}
