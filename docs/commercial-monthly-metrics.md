# Indicadores comerciais mensais

`/dashboard?month=YYYY-MM` mantém o funil de status atuais e apresenta a atividade mensal em uma seção independente. O seletor nativo de mês navega automaticamente com `router.push` após uma seleção válida; a URL e o campo permanecem sincronizados ao voltar/avançar. Valores inválidos ou futuros na URL usam o mês atual, com uma mensagem na interface. Cada indicador apresenta total e tendência resumida; valores comparáveis, cobertura e motivos de indisponibilidade ficam em detalhes expansíveis acessíveis por clique, teclado e toque. O controle “Entenda” reúne as explicações gerais.

- Cadastros: `Lead.createdAt`, por proprietário.
- Propostas, ganhos e perdas: `LeadStatusHistory.occurredAt`, com `COUNT(DISTINCT leadId)` por etapa e mês. Um lead pode participar de etapas diferentes e de meses diferentes, mas não é duplicado na mesma etapa/mês.
- Limites: início inclusivo e fim exclusivo no fuso IANA `America/Sao_Paulo`, convertidos para instantes UTC; não há offset fixo. O mês em andamento termina no instante da consulta.
- Meses encerrados: diferença absoluta e percentual entre o mês selecionado completo e o anterior completo, mesmo quando os meses têm durações diferentes.
- Mês em andamento: o total principal inclui o acumulado até o instante da consulta. A diferença e o percentual usam somente os dias completos já transcorridos em São Paulo, sem incluir o dia atual. Em 22/10, a comparação é de 01/10 a 21/10 versus 01/09 a 21/09. Os cards mostram separadamente o valor de cada período comparável, que pode ser menor que o total principal.
- Durações diferentes no mês atual: o número de dias completos é limitado à quantidade de dias do mês anterior **nos dois intervalos**. Em 31/03/2025, compara-se 01–28 de março a 01–28 de fevereiro; em 2024, compara-se 01–29 de março a 01–29 de fevereiro. Os dias extras continuam no total principal, sem projeções.
- No primeiro dia do mês não há dias completos para comparar: o acumulado permanece visível, mas valores comparáveis, diferença e percentual ficam indisponíveis, em vez de representar uma falsa estabilidade entre dois zeros.
- Base anterior zero gera “Sem base de comparação”; dois zeros em intervalos válidos representam estabilidade. Não se calcula taxa de conversão mensal entre eventos de coortes diferentes.

O cálculo dos limites fica em `getCommercialPeriods()`. Os intervalos de comparação têm início inclusivo e fim exclusivo na meia-noite local após o último dia incluído. A conversão IANA também trata mudanças históricas de horário de verão e dias em que a meia-noite não existiu.

Em cada métrica, `current` é o total principal, `comparisonCurrent` é o valor atual usado na comparação e `previous` é o valor do intervalo anterior correspondente. `difference` e `percentageChange` derivam exclusivamente de `comparisonCurrent` e `previous`. Nos meses encerrados, `current` e `comparisonCurrent` coincidem. As contagens distintas de transições são independentes em cada intervalo: repetições do mesmo lead no dia atual não alteram a comparação dos dias completos.

## Cobertura histórica

O marco é o `finished_at` da migration `20261022160000_create_lead_status_history`, consultado em `_prisma_migrations`, sem incluir aplicações revertidas ou incompletas. Essa data registra a instalação do histórico nesse banco, sem inferir datas a partir do primeiro evento, de `Lead.updatedAt` ou do nome da migration.

Meses anteriores ao marco apresentam histórico indisponível, com valor nulo em vez de zero. O mês que contém o marco apresenta os eventos registrados como histórico parcial. A cobertura do total principal e a de **cada intervalo efetivamente comparado** são verificadas separadamente. Somente dois intervalos inteiramente cobertos permitem diferença e percentual de transições; valores parciais permanecem identificados, sem substituir indisponibilidade por zero. A ausência do registro da migration mantém essas métricas indisponíveis; os cadastros continuam funcionando.

O marco pressupõe que a funcionalidade de registro de transições entrou em operação junto da instalação da migration e continuou ativa. Alterações diretas no banco ou intervalos em que outro código alterou status sem histórico não podem ser reconstruídos ou detectados por esse indicador. Ao importar/restaurar bancos, preserve os registros de migrations; se houver lacunas conhecidas, o marco precisa ser revisto antes de tratar os períodos como completos. Exclusões de leads também removem seus históricos por regra já existente, portanto os relatórios refletem os leads que permanecem no banco.

Não foram criados snapshots, eventos retroativos, tabelas ou índices adicionais. As consultas usam os índices atuais de proprietário e de lead/data; agregam no PostgreSQL e não carregam eventos individuais para a aplicação.

## Verificação

```sh
pnpm exec tsx --test src/server/leads/commercial-month.test.ts src/server/leads/lead-monthly.service.test.ts src/components/dashboard/monthly-performance.test.tsx
LEAD_MONTHLY_DATABASE_TEST=1 pnpm exec tsx --test src/server/leads/lead-monthly.integration.test.ts
# Com PostgreSQL e um servidor Next local na porta 3102:
MONTHLY_UI_BROWSER_TEST=1 pnpm exec tsx --test src/components/dashboard/monthly-performance.browser.test.ts
```

O teste PostgreSQL cria somente usuários, categoria, leads e transições descartáveis, removidos ao final. Requer o banco com a migration de histórico aplicada.
