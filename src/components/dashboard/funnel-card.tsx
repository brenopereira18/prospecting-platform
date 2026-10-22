import { Funnel } from "lucide-react";
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
        className="relative h-2.5 overflow-hidden rounded-full bg-sidebar-hover"
      >
        <div
          style={{ width: `${percentage}%` }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary"
        />
      </div>
    </div>
  );
}

export function FunnelCard({ data }: { data: LeadCommercialFunnelDTO }) {
  return (
    <section
      aria-labelledby="commercial-funnel-title"
      className="mt-6 rounded-xl border border-sidebar-hover bg-card text-foreground shadow"
    >
      <div className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Funnel aria-hidden="true" className="h-4 w-4 text-primary" />
              <h2
                id="commercial-funnel-title"
                className="text-base font-semibold"
              >
                Funil comercial
              </h2>
            </div>
            <p className="mt-1 text-xs text-secundary">
              Distribuição por status atual
            </p>
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
        <div role="group" aria-label="Em andamento" className="space-y-3.5">
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
          className="mt-5 space-y-3.5 border-t border-sidebar-hover pt-4"
        >
          <p className="text-xs text-secundary">Resultados</p>
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
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-sidebar-hover bg-sidebar-hover/40 px-4 py-3">
          <div>
            <p className="text-sm text-secundary">Taxa de conversão</p>
            <p className="mt-1 text-xs text-secundary">
              Leads ganhos ÷ total de leads cadastrados.
            </p>
          </div>
          <span className="text-2xl font-semibold tabular-nums text-primary">
            {percent.format(data.conversionRate / 100)}
          </span>
        </div>
      </div>
    </section>
  );
}
