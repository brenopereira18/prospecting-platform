# Contratos recorrentes — primeira versão

## Fluxo

Financeiro → Venda → Cadastrar contrato. A seção **Contratos** permite buscar pelo
cliente e filtrar por estado. No contrato, gere uma competência explicitamente,
abra a mensalidade e utilize os mesmos controles de recebimento e estorno das
contas de desenvolvimento. Nenhuma operação envia cobranças ou registra pagamento
automaticamente.

## Regras de competência

- Competência é um mês civil em `America/Sao_Paulo`, armazenado como `DATE` no dia 1.
- A geração manual admite o mês inicial até o mês atual, inclusive. Não antecipa
  competências futuras. Uma venda pode ter mais de um contrato independente.
- O cadastro declara o início contratual (que pode ser anterior ao cadastro, mas
  não à venda). A condição inicial vale desde esse mês declarado pelo usuário.
- Edições e mudanças de estado valem no mês corrente, ou no mês inicial se o
  contrato ainda não começou. Não é possível retroagir essas operações pela UI/API.
- Para uma competência ainda não gerada, utiliza-se a última condição/estado com
  vigência até aquele mês. Se houver várias alterações no mesmo mês, vale a última.
  Assim, reativar no mesmo mês permite gerá-lo; meses inteiros de suspensão continuam
  bloqueados. Competências anteriores ativas podem ser geradas mesmo após cancelar.
- Contas já geradas são imutáveis: suspensão, cancelamento ou edição não mudam valor,
  descrição, vencimento, forma prevista ou pagamentos. Uma repetição de geração
  apenas reutiliza a conta existente.
- Cancelamento é definitivo. Reativação se aplica somente à suspensão; um novo
  acordo após cancelamento requer outro contrato.
- Não há proporcionalidade diária, multa, juros ou reajuste automático. O primeiro
  mês usa o valor integral; seu vencimento nunca antecede a data de início.
- Dia 29/30/31 inexistente é ajustado ao último dia daquele mês, sem deslocar os
  vencimentos dos meses seguintes.

## Integridade e totais

`RecurringContract` pertence ao proprietário da venda. `RecurringContractHistory`
guarda estado, motivo, instante do servidor, competência de vigência e um snapshot
das condições a cada revisão. Atualizações usam bloqueio da linha e revisão otimista.

Mensalidades são `Receivable`, com `contractId` e `competence`, sem parcela de venda.
Uma restrição única protege contrato/competência e a chave estrangeira composta
garante que a mensalidade pertence à mesma venda do contrato. São usados os mesmos
`Receipt`, `ReceiptReversal`, bloqueios e validações financeiras existentes.

Os totais de vendas de desenvolvimento continuam excluindo mensalidades e seus
recebimentos. Contratos mostram seus próprios saldos em aberto e vencidos (líquidos
de estornos). Isso evita diminuir o saldo de uma venda com pagamentos recorrentes.
Não se calcula MRR ou projeções de receita nesta versão.

Não há exclusão de contratos/histórico pela aplicação. A migration preserva as
contas antigas e adiciona restrições e trigger contra reescrita do histórico.

## Verificação

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec tsx --test src/server/finance/recurring.test.ts
FINANCE_DATABASE_TEST=1 pnpm exec tsx --test src/server/finance/recurring.integration.test.ts
# Com a aplicação local disponível:
FINANCE_BROWSER_TEST=1 FINANCE_UI_BASE_URL=http://localhost:3102 pnpm exec tsx --test src/server/finance/recurring.browser.test.ts
```

Testes de banco/navegador criam e removem somente registros descartáveis próprios.
Decisões para uma evolução futura: proporcionalidade, suspensão a partir do mês
seguinte, crédito/cancelamento de mensalidades já emitidas e cobrança externa.
Não estão implementadas nem são simuladas nesta versão.
