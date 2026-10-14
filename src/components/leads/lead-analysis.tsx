import {
  ChartNoAxesCombined,
  Globe,
  Info,
  MessageSquare,
  Phone,
  Star,
} from "lucide-react";
import type { PreliminaryScoreResult } from "@/src/server/scoring/preliminary-score.service";

interface LeadAnalysisProps {
  score: number | null;
  analysis: PreliminaryScoreResult | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number | null;
}

export function LeadAnalysis({
  score,
  analysis,
  website,
  phone,
  rating,
  userRatingCount,
}: LeadAnalysisProps) {
  const criteria = [
    {
      key: "website",
      icon: Globe,
      label: "Site",
      detail: website ? "Site identificado" : "Não identificado",
      max: 45,
    },
    {
      key: "phone",
      icon: Phone,
      label: "Telefone",
      detail: phone ?? "Não informado",
      max: 25,
    },
    {
      key: "reviewCount",
      icon: MessageSquare,
      label: "Quantidade de avaliações",
      detail:
        userRatingCount !== null
          ? `${userRatingCount.toLocaleString("pt-BR")} avaliações no Google`
          : "Quantidade não informada",
      max: 20,
    },
    {
      key: "rating",
      icon: Star,
      label: "Nota do estabelecimento",
      detail:
        rating !== null
          ? `${rating.toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} de 5 estrelas`
          : "Sem avaliação informada",
      max: 10,
    },
  ] as const;

  return (
    <section aria-labelledby="lead-analysis-title" className="space-y-6">
      <div className="max-w-2xl">
        <h2
          id="lead-analysis-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Análise preliminar
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-secundary">
          Potencial de oportunidade calculado a partir dos dados do
          estabelecimento.
        </p>
      </div>

      {score === null || analysis === null ? (
        <div className="flex items-start gap-4 rounded-xl border border-dashed border-sidebar-hover p-6 sm:p-8">
          <ChartNoAxesCombined
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-secundary"
          />
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Pontuação ainda não calculada
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-secundary">
              Consulte os dados do negócio acima enquanto a análise preliminar
              não está disponível.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-7">
            <h3 className="text-sm font-medium text-foreground">
              Score de oportunidade
            </h3>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-6xl font-semibold tracking-tighter text-primary tabular-nums">
                {score}
              </span>
              <span className="text-sm text-secundary">/ 100</span>
            </div>
            <div
              role="meter"
              aria-label="Score de oportunidade"
              aria-valuenow={Math.min(100, Math.max(0, score))}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-5 h-2 overflow-hidden rounded-full bg-sidebar-hover"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-secundary">
              Quanto maior a pontuação, maior o potencial de oportunidade pelos
              critérios analisados.
            </p>
            <div className="mt-6 flex items-start gap-2.5 border-t border-primary/15 pt-5 text-xs leading-relaxed text-secundary">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                Esta análise considera site, telefone e avaliações. Use esses
                sinais para preparar sua abordagem.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-sidebar-hover bg-card">
            <div className="border-b border-sidebar-hover px-5 py-5 sm:px-7">
              <h3 className="text-sm font-semibold text-foreground">
                Composição da pontuação
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-secundary">
                O que contribui para o score deste negócio.
              </p>
            </div>
            <div className="divide-y divide-sidebar-hover px-5 sm:px-7">
              {criteria.map((criterion) => {
                const value = analysis.breakdown[criterion.key];
                const percentage = Math.min(
                  100,
                  Math.max(0, (value / criterion.max) * 100),
                );
                const Icon = criterion.icon;

                return (
                  <div key={criterion.key} className="py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Icon
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-secundary"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {criterion.label}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-secundary [overflow-wrap:anywhere]">
                            {criterion.detail}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-semibold tabular-nums ${value > 0 ? "text-primary" : "text-secundary"}`}
                        >
                          +{value} pts
                        </p>

                        <p className="mt-1 text-xs text-secundary">
                          de {criterion.max}
                        </p>
                      </div>
                    </div>
                    <div
                      aria-hidden="true"
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-sidebar-hover sm:ml-7"
                    >
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-sidebar-hover px-5 py-4 text-xs leading-relaxed text-secundary sm:px-7">
              A ausência de site contribui com até 45 pontos para a
              oportunidade.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
