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
      label: "Site",
      detail: website ? "Site identificado" : "Não identificado",
      max: 45,
    },
    {
      key: "phone",
      label: "Telefone",
      detail: phone ?? "Não informado",
      max: 25,
    },
    {
      key: "reviewCount",
      label: "Quantidade de avaliações",
      detail:
        userRatingCount !== null
          ? `${userRatingCount.toLocaleString("pt-BR")} avaliações no Google`
          : "Quantidade não informada",
      max: 20,
    },
    {
      key: "rating",
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
    <section className="rounded-xl border border-sidebar-hover bg-terciary p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Análise preliminar
        </h2>

        <p className="mt-1 text-sm text-secundary">
          Potencial de oportunidade calculado a partir dos dados do
          estabelecimento.
        </p>
      </div>

      {score === null || analysis === null ? (
        <p className="mt-6 text-sm text-secundary">
          Este lead ainda não possui uma análise preliminar.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Score total */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-foreground">
                {score}
              </span>

              <span className="text-sm text-secundary">/ 100 pontos</span>
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sidebar-hover">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, score))}%`,
                }}
              />
            </div>
          </div>

          {/* Composição */}
          <div className="border-t border-sidebar-hover pt-5">
            <h3 className="mb-5 text-sm font-semibold text-foreground">
              Composição da pontuação
            </h3>

            <div className="space-y-5">
              {criteria.map((criterion) => {
                const value = analysis.breakdown[criterion.key];

                const percentage = (value / criterion.max) * 100;

                return (
                  <div key={criterion.key}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {criterion.label}
                        </p>

                        <p className="mt-1 break-words text-xs text-secundary">
                          {criterion.detail}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground">
                          +{value} pts
                        </p>

                        <p className="text-xs text-secundary">
                          de {criterion.max} possíveis
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="border-t border-sidebar-hover pt-4 text-xs text-secundary">
            Pontuação preliminar baseada na presença de site, telefone,
            quantidade de avaliações e nota do estabelecimento.
          </p>
        </div>
      )}
    </section>
  );
}
