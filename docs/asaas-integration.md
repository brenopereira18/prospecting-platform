# Asaas — integração financeira em Sandbox

## Estratégia e limites confirmados

- Checkout hospedado (`POST /v3/checkouts`), Pix e cartão, `DETACHED` + `INSTALLMENT` quando permitido pelas regras locais.
- Até 21 parcelas no checkout; a bandeira/conta pode limitar mais. Valor mínimo de cartão: R$ 5 por parcela. As faixas aplicam o maior piso compatível; abaixo da primeira faixa, à vista. Sem faixas, aplica-se o limite geral.
- Taxas absorvidas pelo vendedor. O Checkout API consultado não documenta um parâmetro para repasse automático por quantidade de parcelas. O Prospecta **não inventa juros nem usa o campo de juros por atraso como juros de parcelamento**. `costMode=BUYER` é rejeitado.
- Total e parcelas definitivos são apresentados pelo Asaas antes da confirmação. O simulador `/payments/simulate` foi consultado no Sandbox; suas estimativas não são lançamentos financeiros.
- Hospedagem usa outro checkout, `CREDIT_CARD` + `RECURRENT`, ciclo `MONTHLY`, com autorização explícita na página de contratação. Texto, valor, primeira cobrança e revisão do contrato ficam registrados junto ao aceite. Status operacional ATIVO do contrato local não comprova contratação nem pagamento.
- A atualização de cartão documentada usa `/subscriptions/{id}/creditCard` e requer cartão ou token. Não há coleta desses dados no Prospecta nem implementação presumida de um portal hospedado de troca de cartão. A atualização feita no Asaas pode ser acompanhada por eventos de assinatura; a interface local de troca permanece pendente de um fluxo hospedado suportado.
- Produção está deliberadamente bloqueada até concluir homologação, configuração de webhook e revisão dessas limitações.

Referências oficiais consultadas:

- https://docs.asaas.com/docs/checkout-asaas
- https://docs.asaas.com/reference/criar-novo-checkout
- https://docs.asaas.com/docs/checkout-para-cart%C3%A3o-de-cr%C3%A9dito
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://central.ajuda.asaas.com/hc/pt-br/articles/31689121385627-Quais-as-formas-de-pagamento-dispon%C3%ADveis-para-cobran%C3%A7as
- https://docs.asaas.com/reference/simulador-de-vendas
- https://docs.asaas.com/docs/faq-assinaturas
- https://docs.asaas.com/docs/eventos-para-checkout
- https://docs.asaas.com/docs/payment-events
- https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint

## Configuração

Somente no servidor:

```dotenv
ASAAS_ENVIRONMENT=sandbox
ASAAS_SANDBOX_API_KEY=<chave gerada em sandbox.asaas.com>
ASAAS_OWNER_USER_ID=<UUID do usuário proprietário do financeiro>
ASAAS_APP_URL=https://<origem pública HTTPS da aplicação>
ASAAS_WEBHOOK_TOKEN=<segredo aleatório de pelo menos 32 caracteres>
```

`ASAAS_API_KEY` não é utilizada: isso evita usar acidentalmente uma chave de produção já existente. A conta Asaas é vinculada explicitamente a um usuário do Prospecta; não é uma integração de cobrança dos usuários do SaaS. Nunca aceite esse UUID pelo cliente.

Aplicar migrations com `pnpm exec prisma migrate deploy` e gerar client com `pnpm exec prisma generate`. Migration nova: `20261029120000_asaas_integration`.

No Sandbox:

1. Cadastrar uma chave Pix (exigência efetivamente retornada pela API ao emitir checkout com PIX).
2. Configurar webhook para `https://<origem>/api/asaas/webhook`, versão 3, envio sequencial, `authToken` igual a `ASAAS_WEBHOOK_TOKEN`.
3. Assinar eventos `CHECKOUT_*`, `PAYMENT_*` e `SUBSCRIPTION_*` disponíveis no painel, incluindo confirmações, recebimentos, recusas, vencimentos, estornos e cancelamentos.
4. A origem local precisa de HTTPS público para receber eventos reais. O callback não autentica nem confirma o pagamento.
5. Nos testes, usar clientes fictícios com `notificationDisabled=true`, sem contatos reais; o Sandbox pode enviar notificações.

## Uso

- Acesso pela sidebar: **Configurações → Asaas** (`/configuracoes#asaas`). Exibe pendências do ambiente e permite editar as regras de parcelamento quando a integração está habilitada para o usuário. Credenciais continuam exclusivas do servidor.
- **Financeiro → Vendas → selecionar venda → Pagamento online → Preparar checkout → Abrir link de pagamento**. No Asaas, o cliente escolhe Pix ou cartão e as parcelas disponíveis.
- **Venda → Contratos recorrentes → Cadastrar contrato → abrir contrato → Preparar contratação mensal → Abrir contratação mensal**. O cliente autoriza a recorrência antes de continuar no Asaas.
- A configuração incompleta ou o usuário não habilitado são apresentados explicitamente nas telas, com link para configuração. Não há ativação automática por presença somente da chave de API.

- Na venda, configurar regras de parcelamento e preparar checkout. Compartilhar o link de contratação, sem envio automático por e-mail/WhatsApp.
- O valor cobrado é o saldo comercial ainda não recebido. Não altera o snapshot da proposta ou as condições históricas da venda. A proposta/contratação deve permitir essas alternativas; não usar o link para renegociar silenciosamente condições já aceitas.
- O checkout local tem token aleatório de 256 bits e validade de 24 horas; o checkout Asaas, 60 minutos. Links e páginas são `noindex`.
- Contratos têm contratação separada, com checkbox de autorização não marcado. O Asaas coleta os dados de cartão.
- Contrato com mensalidade manual já gerada no mês atual ou posterior não inicia recorrência nesse período: evita duplicação. Começar em um período sem mensalidade gerada.
- `Conciliar` consulta cobranças do checkout/assinatura; `Reprocessar eventos` tenta os primeiros 25 eventos pendentes.
- Suspender/reativar/cancelar pelo controle existente do contrato também sincroniza o Asaas quando vinculado. Cancelar chama DELETE externo antes da mudança local. O Asaas remove cobranças pendentes/vencidas da assinatura; os registros locais permanecem para revisão e histórico, não são apagados.
- Para modificar valor/condições de contrato vinculado, cancelar a recorrência e obter uma nova contratação. Não alterar cobranças autorizadas silenciosamente.

## Persistência, conciliação e recuperação

`AsaasPolicy`, `AsaasCheckout`, `AsaasPayment`, `AsaasEvent` armazenam apenas configuração, correlação e metadados. `Sale`, `Receivable`, `Receipt` e `ReceiptReversal` continuam sendo o financeiro. Não são armazenados cartão, token de cartão, payload completo com dados pessoais, ou segredo de API.

- Webhook exige `asaas-access-token`, comparado em tempo constante, e limita corpo a 128 KiB. Evento é gravado antes de responder; `after()` processa após a resposta. Falhas ficam persistidas e podem ser reprocessadas explicitamente; não há worker/cron ou garantia de execução contínua após encerramento do processo.
- Unicidade do evento e locks transacionais protegem duplicações. O processamento consulta a cobrança na API, não confia no status enviado pelo navegador. Uma cobrança remota gera no máximo uma primeira baixa distribuída nas contas locais, em ordem de vencimento.
- `CONFIRMED` não gera recebimento. `RECEIVED` gera Receipt pelo principal liquidado; data de crédito efetivo tem preferência sobre a data de pagamento. Criação de cobrança, assinatura ou callback não gera Receipt.
- `grossAmount`, `buyerCharges`, `providerFee` e `netAmount` ficam separados. Dados não informados são `null`, não taxas inventadas. O valor principal recebido exibido no financeiro é quitação comercial antes de taxas, não saldo líquido disponível no banco. Valores líquidos não devem ser somados novamente ao principal.
- Snapshot de pagamento e lançamentos são gravados na mesma transação. Divergência de valor/saldo aborta toda a baixa e mantém o evento pendente.
- Recebimento manual é bloqueado enquanto existir checkout/assinatura em aberto; recebimentos Asaas não podem ser estornados manualmente no Prospecta. Estorno total confirmado gera ReceiptReversal, preservando o original. Estornos parciais e resolução de disputas de chargeback exigem revisão específica antes da produção.
- POST de criação nunca é repetido automaticamente após timeout/erro de servidor. Estado `UNKNOWN`/`CREATING` exige recuperar o ID pelo webhook `CHECKOUT_CREATED`/`externalReference` ou suporte no provedor. Não emitir outra cobrança para contornar incerteza.
- Alterações externas de contrato reservam estado `CHANGING_*`. Em interrupções, aguardar 90 segundos e conciliar antes de tentar novamente. Falha externa não informa cancelamento local concluído.
- Sem webhook público, o usuário deve conciliar manualmente. Esse modo não substitui a homologação de entrega dos webhooks antes de produção.

## Testes

```bash
pnpm exec tsx --test src/server/finance/asaas.test.ts src/server/finance/finance.test.ts src/server/finance/recurring.test.ts
FINANCE_DATABASE_TEST=1 pnpm exec tsx --test src/server/finance/asaas.integration.test.ts src/server/finance/finance.integration.test.ts src/server/finance/recurring.integration.test.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
ASAAS_BROWSER_TEST=1 pnpm exec tsx --test src/server/finance/asaas.browser.test.ts
```

Os testes de integração usam PostgreSQL real e Asaas simulado, com fixtures próprias e limpeza. Cobrem isolamento, preparação concorrente, limites/faixas, consentimento, confirmação versus recebimento, duplicatas, alocação, reversão, rollback, cancelamento e timeout sem reemissão.

Homologação real: criar uma venda de teste, preparar checkout, validar Pix e cartão à vista/parcelado, simular recebimento no Sandbox, conciliar e conferir principal/taxas/líquido. Criar contratação mensal separada, confirmar o aceite, pagar no checkout, verificar a assinatura e suas cobranças, cancelar e confirmar ausência de cobranças futuras. Confirmar webhook duplicado sem nova baixa. Não considerar homologação completa somente porque o checkout foi criado.

## Validação realizada nesta implementação

- 26 testes unitários/de apresentação e 37 verificações de integração PostgreSQL passaram. Os testes transacionais usam Asaas simulado, incluindo recusas, recebimentos, duplicatas, suspensão, reativação, cancelamento e falhas incertas.
- O teste Chromium passou em desktop e 390px: preparação sem chamada externa, regras de parcelas, contratação pública sem sessão, aceite obrigatório por teclado e webhook autenticado com limite de tamanho e evento duplicado. Ele inicia servidor próprio na porta 3105, com chave falsa, após `pnpm build`, e limpa suas fixtures. Não executar build simultaneamente a esse teste.
- TypeScript e build passaram. Lint sem erros; permanece o aviso anterior de dependência do hook em `lead-filters.tsx`.
- Sandbox real: chave autenticada, simulador consultado, checkouts de Pix/cartão e recorrência criados. Chromium confirmou opções de cartão de 1 a 6 parcelas e Pix à vista. Ao finalizar, o provedor exigiu reCAPTCHA; nenhum pagamento ou assinatura efetiva foi considerado homologado. A conclusão, recusa real de cartão e entrega externa de webhooks precisam de teste manual.
- O cliente descartável remoto e as fixtures locais foram removidos. Houve tentativas de cancelar os dois últimos checkouts; o provedor recusou a operação, possivelmente por expiração. Não foram encontradas cobranças nem assinaturas associadas ao cliente de teste. Os registros de checkout podem permanecer no histórico do Sandbox.
- Ainda é necessário configurar proprietário, origem HTTPS pública e segredo/webhook. Não houve chamada à API de produção.
