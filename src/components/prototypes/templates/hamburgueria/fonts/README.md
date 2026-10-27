# Caveat local

`Caveat-Variable.ttf` é a fonte Caveat original, com eixo de peso 400–700, obtida do repositório oficial Google Fonts:

- Fonte: https://github.com/google/fonts/blob/main/ofl/caveat/Caveat%5Bwght%5D.ttf
- Licença: `OFL-Caveat.txt` (SIL Open Font License 1.1).

O arquivo é usado por `next/font/local` no contêiner do template. Os pesos 600 e 700 e a variável `--font-hamburgueria-hand` continuam disponíveis, incluindo a seleção de Caveat nos controles do editor.

Motivo: no Next.js/Turbopack 16.3.3, o CSS remoto da Caveat pode trazer URLs `fonts.gstatic.com/l/font?kit=...&skey=...&v=...`. O resolver interno falha com `next/font/google queries have exactly one entry`, seguido de `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`. A cópia local elimina esse caminho de resolução sem alterar as dependências ou desativar Turbopack.

Barlow e Barlow Condensed continuam com seu carregamento existente. Nenhum outro template do projeto utiliza Google Fonts; Geist pertence ao layout da aplicação. Ao atualizar esta fonte, preserve o arquivo de licença e verifique a prévia e o editor, incluindo os pesos 600/700 e caracteres acentuados.
