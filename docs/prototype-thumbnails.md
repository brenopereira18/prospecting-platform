# Miniaturas privadas de versões

Cada card usa a miniatura da última versão **existente**, sem renumerar snapshots. O rascunho não é a origem da captura. Sem versão ou miniatura, o espaço 16:9 permanece reservado e a listagem continua utilizável.

O grid estica os cards da mesma linha, limita o título a duas linhas e mantém as ações no rodapé. Apenas em `/prototipos`, a sidebar existente vira uma faixa de ícones abaixo de 640 px, com nomes acessíveis e alvos de toque; as demais páginas conservam seu layout.

## Preparação

```sh
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec playwright install chromium
```

No Linux de deploy, instale também as dependências do navegador na imagem de execução (`pnpm exec playwright install --with-deps chromium`, quando apropriado). O binário precisa estar acessível ao usuário que executa o Next.js, inclusive se `PLAYWRIGHT_BROWSERS_PATH` for configurado.

Reutiliza `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` e `R2_ENDPOINT`. O bucket continua privado.

Configure `THUMBNAIL_APP_ORIGIN` com a origem confiável desta aplicação, acessível pelo próprio servidor. Exemplo local: `http://127.0.0.1:3000`. Esse é o padrão em desenvolvimento; em produção a variável é obrigatória. HTTPS é aceito; HTTP somente em loopback. Caminhos, credenciais, query strings e origens fornecidas pelo cliente são rejeitados. A origem precisa servir a mesma aplicação, banco e assets.

## Uso

1. Salve uma versão normalmente no editor.
2. Abra `/prototipos` e clique em **Gerar miniatura** no card.
3. A captura ocorre nessa requisição explícita. A operação de salvar/criar versão não foi alterada.
4. A miniatura abre o snapshot correspondente. O botão **Prévia** continua abrindo o rascunho salvo.

O mesmo botão atende versões já existentes: não há backfill automático ou geração durante a listagem. Versões antigas sem metadados continuam válidas. A API permite gerar qualquer versão autorizada, enquanto os cards apresentam somente a última.

`POST /api/prototipos/[id]/versoes/[versionId]/miniatura` gera/reutiliza; não recebe userId, caminho de objeto, URL de destino ou documento no corpo. Exige sessão válida e origem da requisição correspondente. `GET` nessa rota lê o WebP após verificar usuário, protótipo e versão. Respostas são privadas, sem cache compartilhado. As imagens usam leitura direta autenticada, sem o otimizador público de imagens do Next.js.

## Captura e armazenamento

Playwright abre a rota existente `/prototipos/[id]/versoes/[versionId]` com somente o cookie de sessão do usuário, restrito à origem configurada. Navegações para outros destinos e recursos fora dessa origem são bloqueados. A página mantém o renderer original e os endpoints privados de imagens.

A captura usa viewport 1440×960, aguarda fontes e imagens relevantes e recorta os primeiros 1440×810 pixels do contêiner do template, excluindo a barra da prévia. Sharp produz WebP 960×540, qualidade 78. Movimento é reduzido e animações são desativadas na captura. Falhas de autenticação, carregamento ou imagens não são gravadas como screenshots de loading.

Chave determinística, separada dos uploads:

```text
thumbnails/v1/users/{userId}/prototypes/{prototypeId}/versions/{versionId}.webp
```

`PrototypeThumbnail` possui uma relação única com a versão, chave do objeto, estado, identificador da tentativa, prazo do bloqueio e datas. Nenhum campo do snapshot ou do PrototypeDocument é modificado.

## Concorrência e recuperação

Uma aquisição atômica no PostgreSQL reserva a versão por três minutos. Tentativas simultâneas recebem uma resposta tratável, e um bloqueio expirado pode ser retomado. Cada processo Node permite somente uma captura de navegador por vez, sem fila ou worker permanente. A gravação condicional já existente do R2 evita sobrescrever o objeto.

Um WebP válido já armazenado é reutilizado. Se o upload terminar e a confirmação do banco falhar, a próxima tentativa recupera o objeto sem recapturar ou reenviar. Falhas preservam o snapshot e permitem tentar novamente. A leitura de um objeto indisponível apresenta fallback no card, sem iniciar geração.

Não há exclusão automática de objetos R2. A remoção de uma versão/protótipo elimina os metadados derivados por FK, mas pode deixar a miniatura órfã no bucket; sua limpeza deve ser tratada posteriormente. Um objeto confirmado como corrompido não é apagado automaticamente e pode exigir manutenção controlada do artefato derivado. Imagens originais nunca são removidas por este fluxo.

## Limites de deploy e validação

Requer Node.js, Chromium, bibliotecas nativas, memória disponível e acesso do servidor à própria aplicação. A rota declara duração máxima de 120 segundos; o provedor precisa aceitar esse orçamento. Ambientes Edge, exportação estática e provedores que proíbem processos Chromium não atendem esta implementação. Falhas de captura não impedem a listagem, edição ou versionamento.

Para validar manualmente, gere a miniatura de uma versão de teste, atualize a listagem, confira o WebP privado e tente novamente: o artefato deve ser reutilizado. Crie outra versão para confirmar que a miniatura anterior permanece independente. Outro usuário deve receber 404 ao tentar acessar a imagem.

Testes unitários usam captura e armazenamento injetados; a suíte principal não exige R2 real nem Chromium. A verificação real do navegador/R2 deve ser reportada separadamente.
