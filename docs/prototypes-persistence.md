# Persistência de protótipos

O playground `/template-editor/hamburgueria` continua restrito ao desenvolvimento e mantém o documento apenas no navegador. O fluxo persistido começa em `/prototipos`, exige a sessão existente e permite criar, editar e reabrir rascunhos privados.

## Preparar o banco local

Com o PostgreSQL disponível e `DATABASE_URL` configurada para o banco local:

```sh
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

A migration `20261020120000_create_prototypes` cria `prototypes` e `prototype_versions`, relações com usuário/lead, índices, contadores e um trigger que rejeita UPDATE de versões. Ela foi gerada com `prisma migrate diff` entre os schemas; não utiliza `db push`. Os modelos seguem os IDs UUID em colunas TEXT e os nomes camelCase existentes.

## Fluxo manual

1. Entre com uma conta existente e acesse `/prototipos`.
2. Use Criar protótipo, informe o nome interno e abra o editor. O rascunho começa com a Brasa Burger validada.
3. Edite o documento e use Salvar rascunho. Reabra pela listagem para confirmar o conteúdo salvo.
4. Com o rascunho salvo, use Criar versão. Ver versões abre a lista; cada versão possui uma visualização autenticada e somente leitura. Visualizar uma versão não restaura nem altera o rascunho.
5. Para testar conflito, abra o mesmo protótipo em duas abas. Salve em uma e tente salvar alterações na outra: a revisão antiga será rejeitada e o conteúdo local será mantido. O editor oferece abrir o rascunho salvo em outra aba para comparação.
6. Enviar uma imagem local continua funcionando na prévia, mas impede persistir o documento. Substitua-a por um asset do template para salvar. Todas as referências de upload são rejeitadas até existir armazenamento permanente, inclusive nas seções ocultas e no SEO.

Opcionalmente, `/prototipos/novo?leadId=<UUID>` associa um lead. A propriedade deve pertencer ao usuário autenticado; essa regra também é validada no serviço. O cliente nunca informa o `userId`.

## Concorrência e versões

Salvar exige `expectedRevision` e executa um UPDATE condicionado por ID, usuário e revisão, incrementando a revisão na mesma transação. A criação de versão incrementa `versionSequence` na linha do protótipo antes de copiar o documento: o lock dessa atualização serializa solicitações concorrentes. A transação e o índice único `(prototypeId, number)` impedem números duplicados e snapshots parciais. Versões não têm operações de edição.

## Testes

```sh
pnpm exec tsx --test src/server/prototypes/*.test.ts
pnpm exec tsx --test src/components/prototypes/editor/hamburgueria/*.test.ts src/components/prototypes/editor/hamburgueria/*.test.tsx src/components/prototypes/templates/hamburgueria/components/*.test.tsx src/components/prototypes/templates/hamburgueria/schema/*.test.ts src/components/prototypes/templates/hamburgueria/lib/*.test.ts
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Os testes de serviço usam um banco em memória simulado, não comprovam locks ou triggers do PostgreSQL. Para executar a suíte real, configure `PROTOTYPE_TEST_DATABASE_URL` com um banco PostgreSQL descartável e aplique as migrations nele:

```sh
DATABASE_URL="$PROTOTYPE_TEST_DATABASE_URL" pnpm exec prisma migrate deploy
pnpm exec tsx --test src/server/prototypes/prototype.integration.test.ts
```

A suíte cria apenas registros identificados como teste e os remove ao terminar. Sem essa variável, o teste de integração é explicitamente ignorado. Falhas de conexão ou migrations ausentes, quando a variável está configurada, fazem o teste falhar. Nunca aponte essa variável para produção.

Se os tipos gerados do Next estiverem desatualizados após criar rotas, execute `pnpm exec next typegen` antes do TypeScript. Isso não altera a configuração do Next.

Armazenamento de arquivos, Cloudflare R2, publicação, domínios e deployments não fazem parte desta etapa.
