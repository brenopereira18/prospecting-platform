# Categorias globais: seed de inicialização

Origem: os 19 registros reais de `categories` no Docker local, exportados em
04/11/2026. `prisma/data/categories.json` preserva ID, nome exato,
prototypeCategoryKey e createdAt, exportados pelo Prisma com a mesma interpretação
UTC dos timestamps sem fuso utilizada pela aplicação. Não contém usuários ou credenciais. Nomes
como `Buffer e eventos` foram preservados literalmente. Não existe campo slug.

Category é global, com `id` UUID e `name` único, e relaciona-se com Lead e
ApproachTemplate. O nome alimenta a consulta textual do Google Places; o ID
continua sendo usado nas referências de leads e abordagens. A chave persistida
`hamburgueria` determina a compatibilidade com o template de protótipos.

## Segurança e idempotência

O seed valida UUIDs, nomes sem alteração/normalização, datas e unicidade da
origem. Usa `name`, a chave única comercial do modelo, para ignorar existentes;
preserva seus IDs, chaves semânticas e datas, mesmo se diferentes do snapshot.
Diferenças de ID/chave são informadas para revisão, sem correção automática.
Um ID da origem associado a outro nome no destino bloqueia toda a operação.

Só são usados INSERTs de Category para registros ausentes, em transação
Serializable. As restrições de nome/ID e skipDuplicates protegem contra
duplicações; a pós-validação confirma todos os nomes antes do commit. Conflitos
de serialização têm até três tentativas. Não há UPDATE, DELETE ou mudanças em
usuários, leads, abordagens, migrations ou outras entidades.

O padrão é dry-run, em transação READ ONLY. A escrita só ocorre com --apply.
Local exige host loopback. Produção exige host Supabase e variável de conexão
separada da DATABASE_URL local, evitando fallback silencioso entre ambientes.
Nenhum seed roda automaticamente no build ou deploy. Prisma 7 usa a configuração
`migrations.seed` de prisma.config.ts para o comando explícito prisma db seed.

## Executar localmente

```sh
pnpm exec prisma db seed -- --target local --dry-run
pnpm exec prisma db seed -- --target local --apply
pnpm exec tsx --test prisma/category-seed.test.ts
CATEGORY_SEED_LOCAL_TEST=1 pnpm exec tsx --test prisma/category-seed.local.test.ts
```

O arquivo .env continua com a conexão Docker. Valores secretos nunca devem ser
passados como argumentos ou incluídos no snapshot, em documentação ou logs.

## Produção: primeiro consultar, depois autorizar

Na auditoria de 04/11/2026, a página Production
`https://prospecting-platform.vercel.app/descobrir-negocios` devolveu HTTP 200 e
`categories: []` nas props RSC de DiscoveryFilters. O serviço CategoryService.list
faz findMany sem filtro ou paginação. Essa é a evidência disponível de zero
categorias pela aplicação publicada. A conexão Supabase não foi acessada por SQL
direto: a DATABASE_URL Production da Vercel é Secret e não pode ser extraída.
O hostname SQL real não foi confirmado. Não confundir essa limitação com uma
consulta SQL direta concluída nem assumir que a contagem futura será a mesma.

Com a lista vazia observada, o plano é inserir 19 categorias e ignorar zero.
Antes da escrita, repetir o dry-run SQL no próprio destino usando uma conexão
Supabase obtida pelo operador em canal seguro. Em Bash, ler a conexão somente na
sessão do terminal, sem editar .env ou variáveis da Vercel:

```sh
read -r -s -p 'Conexão PostgreSQL Supabase: ' CATEGORY_DATABASE_URL
printf '\n'
export CATEGORY_DATABASE_URL
pnpm exec tsx prisma/seed.ts --target production --database-env CATEGORY_DATABASE_URL --dry-run
unset CATEGORY_DATABASE_URL
```

Somente após aprovação explícita do plano, repetir a leitura segura da conexão
e executar a operação de escrita:

```sh
read -r -s -p 'Conexão PostgreSQL Supabase: ' CATEGORY_DATABASE_URL
printf '\n'
export CATEGORY_DATABASE_URL
pnpm exec tsx prisma/seed.ts --target production --database-env CATEGORY_DATABASE_URL --apply
unset CATEGORY_DATABASE_URL
```

O comando acessa somente categories, não aplica migrations, preserva dados
existentes e imprime destino sem usuário/senha. Qualquer falha de conexão,
schema ausente ou conflito exige investigação, não uma migration automática.

## Diagnóstico de falhas do seed

O CLI informa categoria, nome, código e mensagem disponíveis na exceção original
e nas causas conhecidas do Prisma/adapter-pg, inclusive originalCode e
originalMessage. Reconhece autenticação, DNS, conexão, timeout, TLS, permissão,
banco inexistente e tabela/coluna ausente; casos sem evidência ficam UNKNOWN.
Não imprime stack, SQL, parâmetros ou metadata arbitrária. Antes de imprimir,
remove URLs, usuário/senha da conexão (inclusive formas codificadas), valores de
parâmetros de autenticação e credenciais em formatos conninfo/Authorization.
Uma falha no encerramento da conexão não substitui a exceção principal.

Repita o mesmo comando --dry-run para obter os detalhes. Reconhecer o destino
configurado não comprova que DNS, TCP, autenticação ou schema estejam corretos.
O diagnóstico não altera o modo padrão READ ONLY nem executa --apply.

## Incidente na auditoria

Uma tentativa com `vercel env run` foi interpretada pela CLI como publicação de
um arquivo temporário, criando um projeto separado de diagnóstico. Esse projeto
e seu deployment foram excluídos; a remoção foi confirmada por project_not_found.
O projeto prospecting-platform e seu banco não foram alterados. Não usar esse
comando como atalho para executar o seed ou tentar obter a credencial Secret.
