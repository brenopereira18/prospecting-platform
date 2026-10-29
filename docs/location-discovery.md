# Localidades na descoberta de negócios

Os 27 estados são uma lista pequena local (`src/server/location/states.json`),
obtida de `https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome`.
Os nomes, siglas e códigos são os oficiais do IBGE. Para atualizar essa lista,
consulte o endpoint oficial e revise as diferenças antes de publicar.

A abertura da página não consulta mais o IBGE. O arquivo não contém municípios.
Os municípios continuam vindo da API oficial, sob demanda por UF. Apenas listas
válidas são armazenadas no Data Cache do Next.js, com revalidação a cada 24 horas.
O cache é público e não contém dados do usuário. Revalidações que falham mantêm
a entrada anterior conforme o comportamento do cache do Next.js. Uma primeira
consulta sem entrada disponível ainda depende da conectividade com o IBGE.

Uma falha nessa primeira consulta não derruba a página: o campo de cidades
apresenta a opção de tentar novamente. Respostas atrasadas de uma UF anterior
não substituem as cidades da UF atual. O fluxo e as consultas Google Places
permanecem os mesmos.

Nos Runtime Logs da Vercel, procure `[location:ibge]`. O log registra UF, região,
tempo decorrido, status HTTP (se houve resposta), tipo do erro e código da causa
(por exemplo `UND_ERR_CONNECT_TIMEOUT`). Não registra respostas, credenciais,
contatos ou mensagens arbitrárias de erros externos. A chamada tem um limite de
5 segundos; isso limita o impacto da falha, sem presumir que corrigiu a rede.

O timeout original não prova bloqueio do IBGE ou problema de uma região
específica. Esse diagnóstico ainda exige evidências do ambiente publicado.

Temporariamente, uma falha na ação de municípios agenda um diagnóstico com
`after()`, sem atrasar a resposta ao usuário. Procure `[location:ibge:diagnostic]`
nos logs após reproduzir o problema no deploy. Duas consultas HTTPS em paralelo,
limitadas a 3 segundos cada, testam IPv4 e IPv6 para o mesmo endpoint do IBGE.
O resultado informa a última etapa atingida (`dns`, `tcp`, `tls`, `http` ou
`response`), endereço público do IBGE, tempos acumulados, status e código do erro.
`ENOTFOUND` apenas em IPv6 pode significar que não há registro IPv6 para o host;
isso sozinho não prova falha na conexão padrão. Se ambas as famílias falharem,
não é correto concluir que forçar IPv4 resolveria. Um HTTP 403/429 indica que
houve conexão e resposta; timeout em TCP ainda não prova bloqueio deliberado.
Não há modificação de DNS global, família de IP, região ou fonte de dados.
As sondagens ficam limitadas a uma execução a cada 5 minutos por instância ativa.
Remova essa instrumentação temporária após fechar o diagnóstico.

## Evidências e comparação controlada

Na ocorrência reportada em `iad1`, o DNS IPv4 resolveu `170.84.40.178` em
5 ms, mas a conexão TCP não terminou em 3 segundos. A sondagem IPv6 falhou
durante DNS com `EBUSY`. Portanto, não há evidência de que forçar IPv4 resolva,
nem de que aumentar o timeout seja suficiente. Esses resultados não distinguem
um bloqueio remoto de uma falha de rota de rede.

A proposta local anterior de trocar a região via `vercel.json` foi retirada,
para não misturar uma mudança de rede com o diagnóstico. Nenhuma configuração
remota foi alterada por esta investigação. Não há confirmação de que o teste em
`gru1` tenha sido aplicado ou executado. O último log fornecido era de `iad1`.

Endpoint temporário preparado: `GET /api/internal/diagnostics/ibge`.
Exige uma sessão válida do Prospecta antes de qualquer chamada externa; retorna
401 sem sessão, 429 se repetido em menos de um minuto na mesma instância, e
410 após 05/11/2026 UTC. Não aceita URL, chave ou cabeçalho como parâmetro.
Não há nova variável de ambiente. A resposta é privada e não armazenável.

O endpoint executa três rodadas sequenciais; cada rodada consulta em paralelo
o endpoint exato de municípios de MG usado pelo serviço e `https://api.github.com/`
(controle público), usando o mesmo `fetch` nativo e timeout de 5 segundos.
Somente horário UTC, status HTTP, duração, tipo/código do erro e identificação
do alvo são registrados em `[location:ibge:http-diagnostic]`. Os corpos das
respostas são descartados. Runtime, versão do Node, região real, URLs fixas e
identificação do commit são devolvidos ao usuário autenticado para comparação.
O limite de execução de 30 segundos se aplica apenas à rota de diagnóstico.

Após revisão e publicação autorizada, abrir a URL autenticado no mesmo domínio
da página que falha. Salvar o JSON; repetir depois de um minuto para distinguir
falha persistente de intermitência. Se IBGE falhar e controle responder, isso
enfraquece a hipótese de indisponibilidade geral de saída da função; não prova
isoladamente quem está bloqueando ou descartando a conexão. Se ambos falharem,
investigar a saída geral, DNS e runtime. Um HTTP 403/429 continua comprovando que
houve resposta HTTP, mesmo sem sucesso da operação.

## Remoção obrigatória após coletar as evidências

Excluir `src/app/api/internal/diagnostics/ibge/route.ts`,
`src/server/location/connectivity-diagnostic.ts` e seu teste. Remover a chamada
`after()` da ação de municípios e os arquivos `location-diagnostics.ts`/teste
quando suas sondagens não forem mais necessárias. A expiração automática é uma
proteção adicional, não substitui a remoção. Não considerar a causa resolvida
apenas porque o endpoint ou os testes locais passam.

## Coleta local de 29/10/2026 (UTC)

Foram executadas três rodadas com `fetch` nativo, sem cache e limite de 5 s,
para a URL de MG acima e o controle GitHub. Os resultados não são simultâneos
ao log de produção fornecido; não excluem uma indisponibilidade naquele horário.

| Ambiente | Início UTC | IBGE (ms), HTTP | Controle (ms), HTTP |
| --- | --- | --- | --- |
| Linux, Node 20.20.2 | 14:05:42 | 347, 158, 47; todos 200 | 96, 20, 28; todos 200 |
| Linux, Node 22.23.3 | 14:05:46 | 427, 151, 54; todos 200 | 189, 27, 22; todos 200 |

Node 24 não estava instalado neste ambiente e não foi instalado para o teste.
Não havia configuração de proxy nem `NODE_OPTIONS` no processo local. Não há
CLI Vercel instalada, projeto vinculado, token ou conector autenticado disponível
para ler os logs privados ou executar o diagnóstico no deployment remoto.
Os dados de `iad1`/Node 24.21.0/TCP timeout são dos logs enviados pelo usuário.
