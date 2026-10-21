# Persistência de protótipos

O playground `/template-editor/hamburgueria` continua restrito ao desenvolvimento e mantém o documento apenas no navegador. O fluxo persistido começa no botão **Gerar protótipo** dos detalhes de um lead e exige a sessão existente. `/prototipos` é a central de gerenciamento dos rascunhos privados e de suas versões.

## Preparar o banco local

Com o PostgreSQL disponível e `DATABASE_URL` configurada para o banco local:

```sh
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

A migration `20261020120000_create_prototypes` cria `prototypes` e `prototype_versions`, relações com usuário/lead, índices, contadores e um trigger que rejeita UPDATE de versões. Ela foi gerada com `prisma migrate diff` entre os schemas; não utiliza `db push`. Os modelos seguem os IDs UUID em colunas TEXT e os nomes camelCase existentes.

## Fluxo manual

1. Entre com uma conta existente e acesse os detalhes de um lead em `/leads`.
2. Use Gerar protótipo para abrir `/leads/[id]/prototipos/novo`. O servidor verifica a propriedade do lead e oferece os templates compatíveis. Com um template, ele já fica selecionado; com vários, a escolha é obrigatória. Confira nome, slogan, descrição, contatos e localização, informe o nome interno e confirme Criar protótipo para abrir o editor persistido. Nenhum registro é criado ao abrir o formulário. Se já houver protótipos, abra um deles ou marque explicitamente que deseja criar outro.
3. Edite o documento e use Salvar rascunho. Reabra pela listagem para confirmar o conteúdo salvo.
4. Com o rascunho salvo, use Criar versão. Ver versões abre a lista; cada versão possui uma visualização autenticada e somente leitura. Visualizar uma versão não restaura nem altera o rascunho.
5. Para testar conflito, abra o mesmo protótipo em duas abas. Salve em uma e tente salvar alterações na outra: a revisão antiga será rejeitada e o conteúdo local será mantido. O editor oferece abrir o rascunho salvo em outra aba para comparação.
6. Enviar uma imagem local continua funcionando na prévia, mas impede persistir o documento. Substitua-a por um asset do template para salvar. Todas as referências de upload são rejeitadas até existir armazenamento permanente, inclusive nas seções ocultas e no SEO.

`/prototipos/novo?leadId=<UUID>` redireciona para a nova página de configuração do lead. Sem `leadId`, redireciona para `/leads`; IDs inválidos ou de outro usuário retornam 404 na página de configuração. O cliente nunca informa o `userId`. A central permite identificar o nome do estabelecimento no documento, editar, visualizar o rascunho salvo em uma rota autenticada, consultar versões e abrir o lead associado.

## Compatibilidade e documento inicial

`Category.prototypeCategoryKey` é uma chave semântica opcional persistida, independente do UUID e do nome de exibição. O registro em `src/server/prototypes/template-registry.ts` associa `hamburgueria` a `brasa-burger`. Categorias sem chave ou com outra chave não recebem esse template. A migration `20261020160000_category_prototype_key` inicializa uma única vez categorias existentes chamadas Hamburgueria ou Hamburguerias. Renomeá-las depois não altera sua compatibilidade. Categorias novas ou com outros nomes exigem configuração explícita dessa chave pelo responsável pelo cadastro, por exemplo:

```sql
UPDATE "categories" SET "prototypeCategoryKey" = 'hamburgueria'
WHERE "id" = 'UUID_DA_CATEGORIA_CONFIRMADA';
```

O formulário é pré-preenchido com nome, telefone e endereço conhecidos do lead. Os demais campos começam vazios, sem extrair cidade/bairro por suposição nem considerar telefone como WhatsApp. Na criação, valores efetivamente preenchidos substituem os campos correspondentes de uma cópia profunda do template completo. Valores opcionais vazios ou ausentes preservam os padrões demonstrativos. Nota (`Lead.rating`) e quantidade de avaliações (`Lead.userRatingCount`) são aplicadas automaticamente pelo servidor ao resumo compartilhado entre Hero e Avaliações. Ausências preservam cada padrão individualmente, e zeros são valores válidos. Esses metadados não são aceitos do cliente. Os depoimentos demonstrativos permanecem intactos.

O formulário permite complementar ou substituir esses valores somente no protótipo, sem atualizar o lead. O schema compartilhado `prototype-configuration.schema.ts` valida os dados tanto na interface quanto no serviço. Erros são associados a cada campo e os valores preenchidos são mantidos em falhas e conflitos. O envio usa um bloqueio local e desabilita os controles enquanto aguarda o servidor; a transação continua protegendo contra submissões de outras abas.

O campo `configuration` é obrigatório na criação pelo lead. O serviço não utiliza mais um preenchimento automático quando ele está ausente. Requisições de formulários antigos são rejeitadas com orientação para atualizar a página. A Server Action genérica `createPrototypeAction` também recusa criações antigas; o caminho ativo da interface é `createLeadPrototypeAction` com a configuração completa. `PrototypeService.create` permanece disponível internamente para as operações que já utilizam documentos validados.

`createHamburgueriaDocumentFromConfig(configuration, leadMetadata?)` parte de `structuredClone(brasaBurgerDefaultDocument)`. Nome atualiza `business.name`, as linhas de marca e o nome no título SEO; slogan preenchido atualiza `business.tagline`; descrição preenchida atualiza Hero, Localização e descrição SEO. Contatos e partes do endereço são substituídos individualmente somente quando preenchidos. O rótulo do Instagram acompanha o perfil informado. O WhatsApp informado é normalizado com DDI brasileiro para números locais. Links precisam usar HTTP(S); sem link de localização explícito, o mapa padrão permanece inalterado. Não há campo de site adicional porque o contrato atual não possui esse campo, e o site do lead não é usado como URL canônica do novo protótipo. Não existem presets visuais: cores e fontes padrão são preservadas para edição posterior. A fábrica não depende do relógio nem gera IDs aleatórios; mesma configuração e mesmos metadados produzem o mesmo JSON. Os dados finais passam novamente pelo schema de documentos persistíveis, preservando o bloqueio de imagens temporárias.

Todas as seções, flags de visibilidade, produtos, categorias, preços, adicionais, depoimentos, FAQ, diferenciais, história, horários, imagens e CTAs demonstrativos permanecem intactos. O documento padrão compartilhado não é modificado e documentos gerados separadamente não compartilham coleções mutáveis. No editor persistido, um aviso discreto orienta a revisão do conteúdo demonstrativo antes da publicação, sem adicionar elementos à landing page. Rascunhos e versões já existentes não são reescritos automaticamente, preservando eventuais edições realizadas pelo usuário.

Criar a partir do lead exige `expectedPrototypeCount`. Uma transação bloqueia a linha do lead com `SELECT ... FOR UPDATE`, valida proprietário/categoria e compara a contagem atual. Contagens desatualizadas ou tentativas sem autorização explícita para outro protótipo retornam conflito. Isso também impede duplicações entre abas/requisições concorrentes. O fluxo legado de criação com `leadId` igualmente verifica compatibilidade e bloqueia duplicações; criação adicional deve usar o fluxo explícito do lead.

## Concorrência e versões

A listagem `/prototipos` oferece Excluir com confirmação explícita. A exclusão é permanente e remove também as versões pelo FK com `ON DELETE CASCADE` existente, preservando o lead. O servidor obtém o usuário da sessão e condiciona a exclusão a ID, proprietário e revisão do rascunho. Uma revisão desatualizada retorna conflito; protótipos inexistentes ou de outro usuário retornam o mesmo erro de não encontrado. O diálogo mantém erros visíveis e bloqueia confirmações repetidas enquanto aguarda a operação. Não há nova migration para essa funcionalidade.

Salvar exige `expectedRevision` e executa um UPDATE condicionado por ID, usuário e revisão, incrementando a revisão na mesma transação. A criação de versão incrementa `versionSequence` na linha do protótipo antes de copiar o documento: o lock dessa atualização serializa solicitações concorrentes. A transação e o índice único `(prototypeId, number)` impedem números duplicados e snapshots parciais. Versões não têm operações de edição.

## Testes

```sh
pnpm exec tsx --test src/server/prototypes/*.test.ts
pnpm exec tsx --test src/components/prototypes/prototype-configuration-fields.test.tsx
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
