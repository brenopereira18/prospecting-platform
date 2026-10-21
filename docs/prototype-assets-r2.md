# Imagens privadas dos protótipos no R2

O editor mantém a seleção de imagens em memória, com prévia imediata. Somente
Salvar rascunho ou Criar versão envia os arquivos temporários ainda utilizados,
inclusive em seções ocultas e SEO. Referências repetidas enviam o arquivo uma
única vez. Criar versão com alterações salva primeiro o rascunho e usa a revisão
retornada para gerar o snapshot imutável.

Uploads concluídos ficam em um cache de recursos da sessão do editor, separado
do documento. Se o upload de outro arquivo, o salvamento ou a revisão falhar,
o documento e os arquivos locais são preservados e a nova tentativa reutiliza
os IDs já recebidos. Resultados de upload sem confirmação podem exigir reenvio;
não há exclusão automática de objetos com resultado incerto.

Depois do salvamento, apenas os IDs temporários correspondentes são substituídos
no documento atual, preservando edições feitas enquanto a requisição aguardava.
As URLs blob são liberadas depois que deixam de ser usadas. Ao reabrir o editor,
a prévia ou uma versão, o servidor resolve os assets autorizados para URLs
privadas, sem armazenar essas URLs no JSON.

## Configuração

O Next.js carrega do `.env.local` as variáveis de servidor:

```dotenv
R2_ACCOUNT_ID=<id da conta Cloudflare>
R2_ACCESS_KEY_ID=<access key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=prospecta-assets
R2_ENDPOINT=https://<id da conta>.r2.cloudflarestorage.com
```

Não use `NEXT_PUBLIC_`. As credenciais precisam permitir leitura, escrita e
exclusão de objetos somente no bucket necessário. O bucket deve continuar
privado: não habilite domínio público, r2.dev ou CORS para upload direto.
O cliente usa região `auto`, conforme a
[documentação R2 para AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).
A configuração é carregada somente na primeira operação, no servidor.

Foi adicionada a migration `20261021180000_create_prototype_assets`. Ela não é
aplicada automaticamente ao iniciar o servidor. Para preparar o banco local:

```sh
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

Nenhuma migration antiga foi modificada. Não utilize `db push` no lugar da migration.

## Endpoints

Todos exigem a sessão existente e a propriedade do protótipo e do asset.
IDs inexistentes, associação incorreta e recursos de outro usuário retornam 404.
Não existe endpoint público nem opção para enviar `userId`, chave R2 ou caminho.

| Método | Caminho                                 | Resultado                                                                                 |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/api/prototipos/[id]/assets`           | Recebe `multipart/form-data`, exatamente um campo `file`; retorna `{ asset }`, status 201 |
| GET    | `/api/prototipos/[id]/assets`           | Lista metadados ativos e URLs privadas do protótipo                                       |
| GET    | `/api/prototipos/[id]/assets/[assetId]` | Retorna a imagem com MIME validado                                                        |
| DELETE | `/api/prototipos/[id]/assets/[assetId]` | Exclui somente se não houver referência em rascunho ou versões; status 204                |

POST e DELETE exigem `Origin` igual à origem da aplicação. Chamadas com `fetch`
na mesma origem usam a sessão do navegador. Clientes de linha de comando devem
enviar também o cookie de sessão e `Origin` correto, sem expor o cookie em logs.
As respostas usam `Cache-Control: private, no-store`, `Vary: Cookie`, `nosniff`
e restrição de incorporação à mesma origem. A leitura não utiliza URL pública
ou URL assinada; as credenciais nunca chegam ao navegador.

O formato da resposta inclui `id`, `prototypeId`, `originalName`, `mimeType`,
`sizeBytes`, `width`, `height`, `createdAt` e `url`. O documento utiliza
`{ source: "upload", assetId: asset.id, alt: "..." }`, preservando os demais
metadados da referência. Nunca salve `url` no JSON.

## Validação e limites

- JPG/JPEG, PNG e WebP estáticos, até 5 MiB por arquivo.
- Extensão, MIME declarado, formato detectado e decodificação real com Sharp.
- Limite de 20 milhões de pixels; imagens corrompidas e animadas são rejeitadas.
- Leitura limitada do corpo a 5 MiB + 64 KiB de overhead multipart, mesmo sem
  `Content-Length`, com prazo de 15 segundos para receber o corpo.
- Operações R2 têm timeout e tentativas limitadas; a leitura confere tamanho e
  SHA-256 contra o registro, sem confiar em Content-Type enviado pelo navegador.
- Configure também no proxy de produção um limite de corpo e limites por usuário
  de tráfego/armazenamento. Esta etapa não implementa cotas nem rate limiting.

Chaves: `users/{userId}/prototypes/{prototypeId}/assets/{uuid}.{ext}`.
O nome original não participa da chave e não aparece em headers sem sanitização.
O PUT utiliza `If-None-Match: *` para impedir sobrescrita, conforme a
[compatibilidade S3 do R2](https://developers.cloudflare.com/r2/api/s3/api/).

## Falhas e exclusão

O serviço registra metadados somente depois do upload. Se o registro falhar,
consulta o ID para detectar um COMMIT que tenha ocorrido sem confirmação. Se
o registro realmente não existir, tenta excluir apenas o objeto recém-enviado.
Se o banco estiver indisponível e o resultado for incerto, preserva o objeto
e registra ID/chave para reconciliação futura. Falhas da compensação e uploads
interrompidos também podem deixar órfãos; não há rotina automática de limpeza.

DELETE bloqueia a linha do protótipo, verifica todo o JSON do rascunho e de todas
as versões (incluindo seções ocultas e SEO) e recusa com 409 se houver referência.
Depois grava `deletionRequestedAt`, remove o objeto no R2 e grava `deletedAt`.
Os metadados são preservados. Repetir DELETE permite concluir falhas de R2 ou do
banco sem reativar a imagem. Assets com exclusão solicitada não podem ser lidos.

Excluir um protótipo coloca `prototypeId` em null nos assets, preservando a chave,
o proprietário e o objeto. Assets órfãos não são expostos pelos endpoints. A FK
do usuário usa RESTRICT para não apagar metadados necessários à reconciliação.
Nenhum rascunho ou versão é alterado pela exclusão de assets. O salvamento e a
criação de versões validam todos os assets dentro da transação que bloqueia o
protótipo: referências locais, inexistentes, de outro proprietário/protótipo ou
com exclusão solicitada são rejeitadas. A criação de um protótipo também não
permite copiar referências de assets pertencentes a outro protótipo.

## Testar manualmente

No editor persistido em `/prototipos/[id]`:

1. Selecione uma imagem do computador e confirme a substituição. A prévia deve
   mudar sem iniciar uma requisição de upload.
2. Use Salvar rascunho e aguarde a confirmação. Recarregue a página: a foto deve
   continuar visível, usando a rota privada de assets.
3. Selecione outra foto e use Criar versão sem salvar antes. O rascunho deve ser
   salvo primeiro e a nova versão deve conter a foto selecionada.
4. Consulte versões anteriores depois de substituir a foto no rascunho: as
   imagens dos snapshots anteriores devem continuar disponíveis.

Para testar somente os endpoints e a conexão, sem editar o documento:

Após aplicar a migration, entre na aplicação e abra um protótipo seu. No console
do navegador, substitua o UUID abaixo e execute:

```js
const prototypeId = "UUID_DO_SEU_PROTOTIPO";
const input = document.createElement("input");
input.type = "file";
input.accept = ".jpg,.jpeg,.png,.webp";
input.onchange = async () => {
  const form = new FormData();
  form.set("file", input.files[0]);
  const response = await fetch(`/api/prototipos/${prototypeId}/assets`, {
    method: "POST",
    body: form,
  });
  console.log(response.status, await response.json());
};
input.click();
```

Copie a URL retornada em `asset.url` e abra na mesma sessão: deve exibir a foto.
Em uma janela sem sessão, a mesma URL deve retornar 401. Outra conta deve receber 404. Isso testa credenciais, upload, registro e leitura sem tocar no documento.
Para excluir o asset de teste não referenciado, execute na mesma origem:

```js
await fetch("/api/prototipos/UUID_DO_PROTOTIPO/assets/UUID_DO_ASSET", {
  method: "DELETE",
});
```

As URLs privadas utilizam `next/image` com `unoptimized`, porque o otimizador
`/_next/image` não encaminha a sessão do navegador. Dimensões, enquadramento e
texto alternativo são preservados, e as fotos do template continuam otimizadas.

## Testes automatizados

```sh
pnpm exec tsx --test src/server/prototype-assets/*.test.ts src/server/storage/*.test.ts
```

Os testes principais usam R2 e banco simulados; os arquivos são decodificados de
verdade. A suíte PostgreSQL opcional usa R2 em memória e exige um banco descartável
com todas as migrations e `PROTOTYPE_TEST_DATABASE_URL`. Ela verifica persistência,
isolamento, versões e preservação de metadados ao excluir um protótipo. Sem essa
variável, o teste é explicitamente ignorado. Não use um banco de produção.
