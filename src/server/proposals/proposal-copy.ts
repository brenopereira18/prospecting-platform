import type { ProposalContent, ProposalDTO } from "./proposal.schema";

// Revise only known boilerplate, keeping custom copy and presented snapshots intact.
export function reviseProposalCopy<T extends ProposalContent>(content: T): T {
  const scope = content.scope
    .replace(
      /Configuração básica de SEO\./g,
      "Configuração inicial de SEO para ajudar os mecanismos de busca a identificar o conteúdo da página.",
    )
    .replace(
      /Até duas rodadas de ajustes antes da entrega final\./g,
      "Até duas rodadas de ajustes antes da entrega final, com os pedidos de revisão reunidos em cada rodada.",
    );
  const maintenance = content.maintenance.replace(
    /pequenas alterações em textos, preços, horários ou imagens/g,
    "alterações pontuais, como atualização de textos, preços, horários ou substituição de imagens",
  );
  const notes = content.notes
    .split("\n")
    .flatMap((line) => {
      const text = line.replace(/^\s*[•*-]\s*/, "").trim();
      if (
        text ===
        "O desenvolvimento será iniciado após a aprovação da proposta e confirmação da entrada, quando aplicável."
      )
        return content.paymentMode === "A_NEGOCIAR"
          ? [
              line.replace(
                text,
                "As condições de pagamento serão acordadas antes da contratação.",
              ),
            ]
          : [];
      if (
        text ===
        "O saldo deverá ser pago na aprovação final do site, antes da publicação definitiva."
      )
        return [];
      return [line];
    })
    .join("\n")
    .trim();
  return { ...content, scope, maintenance, notes };
}
export function proposalPresentationContent(
  proposal: ProposalDTO,
): ProposalDTO {
  return proposal.status === "RASCUNHO" && !proposal.lockedAt
    ? reviseProposalCopy(proposal)
    : proposal;
}
