# Propostas comerciais

## Fluxo

Lead → aba Propostas → Nova proposta → Salvar rascunho → revisar / baixar PDF → marcar como enviada.

Marcar como enviada apenas registra o status. Não envia mensagens. Uma proposta aceita não registra recebimento nem altera o status do lead.

Rascunhos permitem edição. Depois do envio, valores, condições, identificação do cliente e responsável ficam preservados. Para negociar outra oferta, use **Duplicar como rascunho**. A cópia possui outro ID e vínculo com a origem; a proposta anterior continua consultável. Estados finais (aceita, recusada, expirada) não voltam a rascunho. A expiração é registrada explicitamente nesta etapa.

Excluir retira a proposta da listagem por `deletedAt`; conteúdo e histórico não são apagados. Links existentes e a referência à origem continuam acessíveis ao proprietário. Não há limpeza física automática.

## Dados e segurança

- `CommercialProposal`: valores `Decimal(12,2)`, conteúdo comercial, identificação capturada na criação, `revision`, `lockedAt`, `sourceProposalId`, exclusão lógica.
- `ProposalStatusHistory`: transições com data e revisão, separadas do histórico do lead.
- Sessão determina o usuário em todas as ações e no PDF. Consultas verificam usuário, lead e proposta.
- IDs de criação/duplicação servem como chave de repetição. Lock de linha e revisão esperada impedem sobrescrita concorrente. Status e histórico usam a mesma transação.
- Trigger PostgreSQL impede alteração de conteúdo após o bloqueio. Check constraints protegem valores e condições de pagamento.
- Reais são enviados como strings decimais; saldo calculado em centavos inteiros, sem arredondamento binário. Pix à vista; cartão entre 1 e 24 parcelas, independentemente para entrada e saldo. Nenhum juro é calculado automaticamente.
- Hospedagem opcional tem mensalidade separada. A indicação de futura cobrança automática é apenas uma condição comercial; nenhuma assinatura é criada.

## PDF

`GET /api/propostas/[id]/pdf` é privado, autorizado e usa `private, no-store`. Gera o documento da proposta escolhida com Playwright já instalado, sem chamadas externas ou execução de JavaScript. Texto é escapado. A apresentação web e o PDF compartilham as condições comerciais em `proposal-presentation.ts`.

O runtime precisa de Node e Chromium com dependências do sistema (`pnpm exec playwright install --with-deps chromium` no ambiente de deploy). Geração limitada a uma por processo; requisições concorrentes recebem 429 e podem tentar novamente. Não há armazenamento de PDFs, fila nem envio automático. A versão comercial é identificada pelo ID da proposta; o PDF pode ser regenerado com os mesmos termos preservados.

## Execução e testes

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec tsx --test src/server/proposals/proposal.test.ts
PROPOSAL_DATABASE_TEST=1 pnpm exec tsx --test src/server/proposals/proposal.integration.test.ts
# Servidor local em localhost:3102, banco migrado e Chromium instalado:
PROPOSAL_BROWSER_TEST=1 pnpm exec tsx --test src/server/proposals/proposal.browser.test.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Testes de integração e navegador criam e removem somente dados próprios descartáveis. Os testes comuns não dependem de Chromium nem PostgreSQL.

## Modalidades de pagamento

O campo **Condições de pagamento** permite escolher:

- **A negociar**: somente o total do desenvolvimento é necessário. Entrada, formas e parcelas ficam `null`, sem termos implícitos. A apresentação e o PDF informam Pix ou cartão, com entrada e parcelamento a combinar antes da contratação.
- **Condições definidas**: mantém entrada opcional, saldo automático, métodos independentes e parcelas entre 1 e 24 no cartão.

A migration `20261023150000_proposal_payment_modes` acrescenta `paymentMode` com padrão `DEFINIDAS`, preservando integralmente os termos das propostas existentes, inclusive as bloqueadas. As validações Zod e constraints PostgreSQL exigem campos definidos nesta modalidade e ausência dos mesmos em `A_NEGOCIAR`. Nenhuma proposta histórica é convertida para negociável.

Para renegociar uma proposta enviada, duplique como rascunho e escolha a modalidade na cópia. O vínculo com a origem, histórico, locks e revisão otimista permanecem. A hospedagem oferecida é um serviço opcional, separado do desenvolvimento; a mensalidade só é devida caso seja contratada.
