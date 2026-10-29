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
