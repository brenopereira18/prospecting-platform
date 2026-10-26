import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { sampleProposal } from "./proposal.test";
import { reviseProposalCopy } from "./proposal-copy";
import { proposalPdfHtml } from "./proposal-pdf";
import { ProposalDocument } from "../../components/proposals/proposal-document";
const notes =
  "• O desenvolvimento será iniciado após a aprovação da proposta e confirmação da entrada, quando aplicável.\n• O saldo deverá ser pago na aprovação final do site, antes da publicação definitiva.\n• Custos de domínio não incluídos.";
const draft = {
  ...sampleProposal,
  status: "RASCUNHO" as const,
  lockedAt: null,
  notes,
  scope:
    "Configuração básica de SEO.\nAté duas rodadas de ajustes antes da entrega final.",
  maintenance:
    "Até 2 solicitações mensais de pequenas alterações em textos, preços, horários ou imagens.",
};
const views = (proposal: typeof sampleProposal) => [
  proposalPdfHtml(proposal),
  renderToStaticMarkup(<ProposalDocument proposal={proposal} />),
];
test("negotiable drafts have no entry or balance deadlines in web and PDF", () => {
  const proposal = {
    ...draft,
    paymentMode: "A_NEGOCIAR" as const,
    deposit: null,
    depositMethod: null,
    depositInstallments: null,
    balanceMethod: null,
    balanceInstallments: null,
  };
  for (const html of views(proposal)) {
    assert.match(html, /Entrada e parcelamento a combinar/);
    assert.match(html, /acordadas antes da contratação/);
    assert.doesNotMatch(
      html,
      /confirmação da entrada|saldo deverá|antes da publicação definitiva/,
    );
    assert.match(html, /Custos de domínio não incluídos/);
  }
  assert.equal(proposal.notes, notes);
});
test("defined drafts retain exact payment amounts and no unregistered deadlines", () => {
  for (const html of views(draft)) {
    assert.match(html, /990,10/);
    assert.match(html, /2\.000,80/);
    assert.match(html, /3 parcelas/);
    assert.doesNotMatch(
      html,
      /confirmação da entrada|saldo deverá|antes da publicação definitiva|a combinar/,
    );
  }
});
test("copy clarification preserves quantities, custom text, values and demo identities", () => {
  const result = reviseProposalCopy(draft);
  assert.match(result.scope, /mecanismos de busca/);
  assert.match(result.scope, /duas rodadas/);
  assert.match(result.scope, /pedidos de revisão reunidos/);
  assert.match(result.maintenance, /Até 2 solicitações mensais/);
  assert.match(result.maintenance, /substituição de imagens/);
  for (const key of [
    "total",
    "deposit",
    "balanceInstallments",
    "issuerName",
    "issuerEmail",
    "clientName",
  ] as const)
    assert.equal(result[key], draft[key]);
  const custom = {
    ...draft,
    scope: "SEO: apenas títulos. Uma rodada.",
    maintenance: "Plano personalizado.",
    notes: "Condição personalizada.",
  };
  assert.deepEqual(reviseProposalCopy(custom), custom);
  assert.deepEqual(reviseProposalCopy(result), result);
});
test("presented and accepted snapshots keep original copy", () => {
  for (const status of ["ENVIADA", "ACEITA"] as const)
    for (const html of views({
      ...draft,
      status,
      lockedAt: sampleProposal.lockedAt,
    })) {
      assert.match(html, /saldo deverá ser pago/);
      assert.match(html, /Configuração básica de SEO/);
      assert.match(html, /pequenas alterações/);
    }
});
