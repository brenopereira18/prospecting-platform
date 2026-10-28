# Bancos de dados por ambiente

O projeto usa a mesma variável `DATABASE_URL` para Prisma CLI e runtime, com
Prisma 7 e `@prisma/adapter-pg`:

- Local: `.env` aponta para o PostgreSQL já existente no Docker. Preserve o
  valor atual; os comandos `prisma migrate deploy` locais continuam usando-o.
- Produção futura: configure `DATABASE_URL` em **Vercel → Project → Settings →
  Environment Variables**, nos ambientes desejados, com a conexão PostgreSQL do
  projeto Supabase. A Vercel injeta essa variável no runtime; não é necessário
  alterar o código ou configurar a Vercel antes de começar o deploy.

Arquivos `.env*` são ignorados pelo Git. Não coloque URLs, senhas ou tokens em
arquivos versionados. O `.env` local não foi alterado.

## Migrations remotas

O schema e o histórico versionado em `prisma/migrations` são comuns aos
ambientes. `prisma.config.ts` lê `DATABASE_URL` e aponta para esse diretório.
Para produção, aplicar migrations deve ser uma etapa explícita e controlada do
processo de release, usando uma URL de conexão compatível com migrations, e não
uma consequência do build da Vercel. Antes disso, revisar o SQL e o estado do
banco de destino. Nenhuma migration foi executada no Supabase nesta preparação.

Para conferir a configuração sem conectar a um banco remoto:

```sh
pnpm exec prisma validate
pnpm exec prisma migrate status
```

`migrate status` conecta ao banco indicado por `DATABASE_URL`; localmente,
execute-o somente com o `.env` apontando para o PostgreSQL Docker. Não o execute
com a URL de produção durante uma simples verificação de configuração.
