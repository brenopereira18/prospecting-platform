# Catálogo local de localidades

A seleção de estados e municípios utiliza `src/server/location/catalog.json`.
A coleta oficial de **29/10/2026 às 20:14:31 UTC** contém **27 UFs e 5.571
registros de municípios**, sem exclusões (incluindo Brasília e Fernando de
Noronha conforme classificados na API de localidades). Os nomes, siglas e
identificadores são os devolvidos pelo IBGE, em UTF-8.

Fonte e documentação: https://servicodados.ibge.gov.br/api/docs/localidades

Endpoints utilizados, todos com `?orderBy=nome`:

- `/api/v1/localidades/estados`
- `/api/v1/localidades/municipios`
- `/api/v1/localidades/estados/{id}/municipios` para cada uma das 27 UFs.

A propriedade `source` de `catalog.json` registra instante da coleta, URLs, contagens e SHA-256 das
29 respostas originais. Registra também hashes normalizados de todos os dados e
de cada UF. Durante a geração, a lista nacional é comparada integralmente às
listas por UF (código, nome e UF), e qualquer divergência interrompe a geração.
A associação usa a hierarquia regional atual da resposta, ou a antiga quando
necessário, validando concordância quando ambas existem. Não há dados inferidos.

## Carregamento na aplicação

`LocationService` importa o JSON no servidor e agrupa os municípios por código de
UF uma vez por processo. `listStates()` e `listCitiesByState()` mantêm os DTOs
existentes e devolvem cópias, protegendo o catálogo contra alterações acidentais.
UFs inválidas ou sem registros retornam `[]`.

A Server Action `getCitiesByState` continua sendo a fronteira entre servidor e
navegador: só os municípios da UF selecionada são enviados ao cliente. Não há
fetch ao IBGE, Data Cache, retry ou timeout nessa operação. A UI mantém o estado
de carregamento para a chamada ao próprio Prospecta, limpa a cidade ao trocar UF
e ignora respostas atrasadas. O Google Places continua recebendo os mesmos nomes
de categoria, cidade e estado para descobrir estabelecimentos.

## Atualização manual e verificável

Em uma máquina com conectividade ao IBGE e Node.js com `fetch` nativo:

```sh
node src/server/location/update-catalog.mjs
pnpm exec tsx --test src/server/location/location.service.test.ts
```

O importador não faz parte do runtime, não usa banco ou credenciais, e não roda
no build nem no deploy. Ele consulta as 29 fontes, valida unicidade, integridade,
contagens e igualdade entre endpoints antes de preparar a publicação. Dados e
metadados ficam em um único JSON; não há mais um arquivo catalog-source.json separado. Revise o diff dos dados e da origem,
inclusive municípios novos/renomeados e contagens por UF, antes de versioná-los.
Os testes offline validam o conteúdo completo contra os fingerprints da coleta;
não prometem refletir alterações oficiais posteriores à data registrada.

## Publicação atômica e recuperação

Requer Node.js 20+ e filesystem local POSIX com `rename` atômico e suporte a
`fsync` de arquivos/diretórios (validado em Linux). Não utilizar em filesystem de
rede ou sincronização de pastas sem confirmar essas garantias.

O atualizador adquire `.catalog-update.lock` com mkdir exclusivo antes da coleta;
um segundo processo é rejeitado, sem tocar no bloqueio do primeiro. A coleta e a
validação completa terminam antes de gravar em `.catalog-stage-*`, no mesmo
filesystem. O candidato é gravado com criação exclusiva, sincronizado com fsync,
relido e validado novamente. O ativo anterior também é validado e salvo como
`catalog.previous.json` por gravação temporária e rename, seguido de fsync do
diretório. Só então **um único rename** substitui catalog.json, publicando dados
e metadados juntos. O diretório é sincronizado novamente. Não há duas trocas
independentes para dados e metadados. O carregador da aplicação permanece igual.

Antes do ponto de publicação, uma interrupção preserva o ativo anterior. Depois,
o ativo é a nova geração completa e o backup contém a anterior. Uma falha após
o rename pode ser reportada apesar de a publicação já ter ocorrido: valide o
ativo e os hashes antes de repetir. Os testes verificam ambas as possibilidades.

Erros comuns limpam apenas o staging e o lock da própria execução. SIGKILL pode
abandonar esses diretórios; eles são ignorados pelo Git e nunca são tratados como
catálogo ativo. **Não existe remoção automática de lock antigo.** Leia owner.json,
confirme que não há atualizador em execução e só então remova manualmente o
bloqueio. Na dúvida, mantenha-o. Diretórios de staging abandonados também podem
ser removidos após essa verificação.

Para recuperar o backup (inclusive se o ativo estiver danificado), sem rede:

```sh
node src/server/location/update-catalog.mjs --restore-previous
```

A recuperação usa o mesmo bloqueio, valida o backup e o publica atomicamente.
Não sobrescreve o backup durante a recuperação. Há uma geração anterior local;
o histórico versionado continua no Git. O backup inicial contém a mesma coleta
atual consolidada, sem mudar códigos, nomes, ordenação ou data de origem.

Testes de falhas e interrupções reais, sem rede ou alterações no catálogo do repo:

```sh
pnpm exec tsx --test src/server/location/catalog-publication.test.mjs src/server/location/location.service.test.ts
```

Para validar a interface real com Chromium, inicie o servidor local (com as
categorias disponíveis no banco local) e execute:

```sh
LOCATION_TEST_URL=http://localhost:3100 pnpm exec tsx --test src/server/location/location.browser.test.ts
```

O teste é opcional quando a URL não está definida e aceita apenas localhost.
Seleciona as 27 UFs no desktop, compara todas as opções e seleciona um município
em cada UF; repete três estados no mobile. Bloqueia e contabiliza requisições do
navegador ao IBGE. O teste do serviço também bloqueia `fetch` no servidor.

## Diagnósticos temporários preservados

A investigação demonstrou em `iad1` e `sfo1`, com Node 24.21.0, DNS IPv4 resolvendo
`170.84.40.178` em 5–7 ms e timeout TCP em cerca de 3 s, antes de TLS/HTTP. IPv6
falhou em DNS com `EBUSY`. O controle GitHub respondeu HTTP 200 nas duas regiões.
Isso não atribui a falha à Vercel nem ao IBGE.

A chamada automática `after()` foi removida da seleção: o catálogo não precisa
de sondas de rede. `location-diagnostics.ts` e seu teste foram preservados como
instrumentação da investigação; não possuem mais consumidores de aplicação.
Podem ser removidos juntos após aprovação de encerramento do diagnóstico.

A rota `/api/internal/diagnostics/ibge`, `connectivity-diagnostic.ts` e seus testes
foram preservados com as alterações locais anteriores. A rota só executa em
Preview (`VERCEL_ENV=preview`), depende da proteção de deployment da Vercel,
consulta apenas IBGE/GitHub e expira em 05/11/2026 UTC. Ela não participa da
seleção de municípios. Remover rota, helpers e testes juntos é a limpeza
recomendada após encerramento da investigação. Excluir arquivos locais não
remove deployments já publicados, que exigem limpeza separada e autorizada.
