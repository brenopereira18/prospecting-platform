# Financeiro pessoal — primeira versão

## Fluxo

Em um lead GANHO, uma proposta ACEITA e disponível oferece **Registrar venda**. A confirmação cria uma venda e seu cronograma de contas a receber em uma única transação. Nenhum pagamento é presumido. Uma proposta pode originar apenas uma venda.

- Condições definidas: total, entrada, métodos e parcelas são preservados da proposta; o usuário informa os vencimentos.
- A negociar: o usuário confirma as condições finais no registro da venda, sem modificar a proposta aceita.
- Parcelas mensais: cada vencimento mantém o dia original quando possível, limitado ao último dia do mês. Os centavos restantes são distribuídos nas primeiras parcelas.
- A hospedagem opcional da proposta permanece no snapshot comercial, mas não gera mensalidades nem integra o total vendido.

## Registros e segurança

`Sale` preserva a proposta aceita e as condições finais em JSONB; valores operacionais usam Decimal(12,2). `Receivable` contém as parcelas. `Receipt` contém cada pagamento efetivo. `ReceiptReversal` registra uma correção com motivo e data do servidor, sem reescrever o pagamento original. Não existem operações de edição ou exclusão financeira nesta versão.

Todos os acessos usam a identidade da sessão. Venda bloqueia lead e proposta na transação; recebimento e estorno bloqueiam a conta a receber. IDs de requisição permitem repetir tentativas sem duplicação. Restrições únicas impedem duas vendas da mesma proposta e dois estornos do mesmo recebimento. Triggers bloqueiam a reescrita dos registros financeiros.

Datas de venda, vencimento e recebimento são datas civis (`DATE`); vencimento e limite de datas futuras usam America/Sao_Paulo. Datas de registro são `TIMESTAMPTZ`.

## Indicadores

- Vendido: soma dos totais das vendas registradas.
- Recebido: soma dos recebimentos sem estorno.
- Pendente: vendido menos recebido.
- Parcialmente recebido: conta com recebimento líquido maior que zero e menor que seu valor.
- Vencido: saldo positivo e vencimento anterior à data atual. Pode coexistir com recebimento parcial.

A listagem é paginada, 25 itens por página. Em Contas a receber, cada item é uma venda completa, com todas as suas contas e históricos expansíveis. As vendas são ordenadas pelo primeiro vencimento com saldo pendente; vendas quitadas ficam ao final. Atraso é indicado separadamente da quitação parcial. Os totais cobrem todo o período; não representam faturamento fiscal nem contabilização de taxas de cartão. O estorno é uma correção de registro, não executa devolução bancária.

## Rotas

- `/financeiro?view=sales|accounts|receipts`
- `/financeiro/vendas/nova?lead=<id>&proposal=<id>`
- `/financeiro/vendas/[id]`

Migration: `20261026180000_create_personal_finance`. Aplicar com `pnpm exec prisma migrate deploy` e gerar cliente com `pnpm exec prisma generate` em outros ambientes.

## Verificação

```sh
pnpm exec tsx --test src/server/finance/finance.test.ts
FINANCE_DATABASE_TEST=1 pnpm exec tsx --test src/server/finance/finance.integration.test.ts
# Com build de produção em localhost:3102:
FINANCE_BROWSER_TEST=1 pnpm exec tsx --test src/server/finance/finance.browser.test.ts
```

Os testes de integração e navegador usam contas descartáveis, com limpeza dos próprios registros ao finalizar. O módulo não modifica status comercial de leads, snapshots de propostas, R2, protótipos ou indicadores do dashboard.
