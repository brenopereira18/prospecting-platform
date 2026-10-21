# Prospecta

SaaS de prospecção de negócios locais, gerenciamento de leads e criação de
protótipos de landing pages. Utiliza Next.js 16, React, TypeScript, Tailwind CSS 4,
Zod, Prisma 7 e PostgreSQL.

## Desenvolvimento local

Utilize uma versão de Node.js compatível com Next.js 16 e o pnpm indicado em
`package.json`. Configure `.env` com `DATABASE_URL`. A descoberta de negócios
também utiliza `GOOGLE_PLACES_API_KEY`. Não versione credenciais.

Comandos de preparação e execução:

```sh
pnpm install
docker compose up -d postgres
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

O PostgreSQL do Compose fica em `localhost:5432`; a conexão de `DATABASE_URL`
deve corresponder às configurações de `docker-compose.yml`. As migrations são
aplicadas pelo comando explícito acima, não pelo servidor de desenvolvimento.
O fluxo persistido exige uma conta existente e login em `/login`.

## Fluxos e estrutura

- `/descobrir-negocios` e `/leads`: descoberta e gerenciamento de leads.
- `/leads/[id]/prototipos/novo`: configuração antes da criação do protótipo.
- `/prototipos`: gerenciamento de rascunhos, prévias privadas e versões.
- `/template-editor/hamburgueria` e `/template-preview/hamburgueria`: playgrounds
  disponíveis somente em desenvolvimento.
- `src/app`: rotas e Server Actions; `src/server`: serviços e DTOs.
- `src/components/prototypes`: editor, contratos Zod e template reutilizável.
- `lib/prisma/client.ts`: cliente Prisma compartilhado.
- `prisma/migrations`: histórico do banco; `docs`: detalhes dos fluxos.

O conteúdo do template vem de `data/default-document.ts` e dos documentos
personalizados. Imagens selecionadas ficam locais até Salvar rascunho ou Criar
versão; os arquivos utilizados são enviados ao R2 privado e o JSON recebe os
IDs permanentes. Consulte [Imagens no R2](docs/prototype-assets-r2.md).
Publicação pública ainda não faz parte do fluxo.

## Verificações

Os testes ficam junto dos módulos e utilizam `node:test` executado pelo `tsx`:

```sh
pnpm exec tsx --test $(rg --files src -g '*.test.ts' -g '*.test.tsx')
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Para a integração real, configure `PROTOTYPE_TEST_DATABASE_URL` com um banco
descartável previamente migrado. Sem essa variável, a suíte PostgreSQL é
explicitamente ignorada. Consulte [Persistência de protótipos](docs/prototypes-persistence.md)
para preparação do banco de testes e verificação manual do fluxo.

As responsabilidades das cores e os limites da verificação de contraste estão
descritos em [Cores do template](docs/hamburgueria-colors.md).
