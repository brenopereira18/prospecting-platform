# Meta mensal de vendas

O card do dashboard usa o mesmo `?month=YYYY-MM` dos indicadores comerciais. Sem parâmetro, usa o mês atual em America/Sao_Paulo; valores inválidos ou futuros seguem o fallback existente.

- Vendas fechadas: soma de `Sale.total` por `Sale.soldOn` no mês, com isolamento por usuário. `soldOn` é DATE, portanto os limites são datas de calendário, sem deslocamento de fuso.
- Clientes conquistados: quantidade de leads distintos com vendas registradas naquele mês. Um cliente com duas vendas conta uma vez; pode aparecer em meses diferentes.
- Ticket médio: total vendido dividido pela quantidade de vendas, com duas casas decimais.
- A meta usa `MonthlySalesGoal.amount` (Decimal 12,2) e um registro único por usuário/mês. Editar outubro não muda setembro. O upsert é atômico; em edições simultâneas, prevalece a última gravação. Não há histórico de revisões dentro do mesmo mês.
- Meta ausente é diferente de zero. São aceitos valores positivos, até duas casas decimais, com ponto ou vírgula decimal.
- Percentual = vendido ÷ meta × 100. O número não é limitado a 100%; apenas a largura visual da barra tem o limite do contêiner. Restante nunca fica negativo; o excedente aparece quando a meta foi superada.

Recebimentos, contas a receber, estornos, propostas aceitas sem venda e alterações de status do lead não compõem o total vendido. Nenhum valor fictício é usado. A migration não cria metas para usuários existentes.

## Verificações

`pnpm exec tsx --test src/server/finance/monthly-sales.test.ts src/components/dashboard/summary-card.test.tsx`

`FINANCE_DATABASE_TEST=1 pnpm exec tsx --test src/server/finance/monthly-sales.integration.test.ts`

Com a aplicação em `http://localhost:3102` (ou `FINANCE_UI_BASE_URL` local):

`FINANCE_BROWSER_TEST=1 pnpm exec tsx --test src/server/finance/monthly-sales.browser.test.ts`

Os testes com banco e navegador criam dados descartáveis e removem seus próprios registros ao terminar.
