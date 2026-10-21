# Cores do template de hamburgueria

## Fluxo

Os controles de Aparência atualizam `document.appearance.colors` no reducer já
existente. `getPreviewDocument` mantém o fallback enquanto um hexadecimal está
incompleto. O renderer passa o documento para `HamburgueriaTemplate`, que calcula
os tokens com `getHamburgueriaColorStyles`. Todas as variáveis ficam no contêiner
`.hamburgueria-template`; o tema do dashboard não é modificado.

O JSON continua armazenando apenas `primary`, `secondary` e `tertiary`. As cores
derivadas são calculadas tanto na prévia quanto ao abrir o documento persistido.
Não há nova propriedade, estado de conteúdo ou alteração de schema.

## Antes e depois

| Elemento                  | Antes                                                     | Agora                                                                           |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Botões principais         | Primária com texto e hover fixos                          | Primária com texto, hover e active derivados                                    |
| Cabeçalho e Hero          | Preto fixo, texto claro presumido                         | Superfície derivada da secundária e primeiro plano contrastante                 |
| Diferenciais e avaliações | Fundos escuros e textos fixos                             | Secundária com texto, detalhes e separadores locais                             |
| Cardápio                  | Terciária com cards claros, preços marrons e badges fixos | Terciária e superfícies derivadas; preço e badge de destaque ligados à primária |
| Categoria selecionada     | Carvão e branco                                           | Primária com texto contrastante                                                 |
| Badge vegetariano         | Verde fixo                                                | Terciária com texto contrastante; a identificação textual permanece             |
| História e chamada final  | Primária com texto escuro presumido                       | Primária com primeiro plano, texto auxiliar e borda derivados                   |
| Como pedir e FAQ          | Branco/creme fixos                                        | Variações da terciária com seus próprios pares de contraste                     |
| Localização               | Textos e ícones fixos                                     | Texto local e acentos da primária; marcador e placa do mapa usam a paleta       |
| Rodapé                    | Fundo e textos fixos                                      | Variação da secundária com textos e links legíveis                              |
| Fallback e carrossel      | Combinações fixas ou semitransparentes                    | Tokens de superfície, texto, hover e foco                                       |

As fotografias não são alteradas. Cores naturais das ruas/parques do mapa
ilustrativo e sombras permanecem independentes da identidade da marca. A placa
com o nome do estabelecimento usa a secundária. O mapa não exibe legenda nem
nomes de ruas; o botão de localização usa os tokens de botão secundário.

## Responsabilidades

- **Primária:** CTAs, seleção do cardápio, badges promocionais, estrelas, preços,
  ícones e destaques; superfícies comerciais já existentes na História e chamada final.
- **Secundária:** base estrutural do cabeçalho, Hero, diferenciais, avaliações,
  destaque de produto e rodapé, além dos botões de apoio.
- **Terciária:** superfície principal, cards, Como Pedir, FAQ e detalhes de apoio.

As três cores padrão permanecem `#f5bb16`, `#141413` e `#f6f3ec`. Tipografia,
conteúdo, fotografias, ordem das seções, medidas e breakpoints são preservados.

## Contraste e limites

Para superfícies sólidas, o cálculo usa luminância relativa sRGB: textos e
acentos têm razão mínima de 4,5:1; foco e bordas de controles, 3:1 contra a
superfície correspondente. Se necessário, o primeiro plano ou acento é clareado
ou escurecido. Hover tem seu próprio primeiro plano; não depende de branco fixo
nem de opacidade que comprometa o contraste. Separadores decorativos não são
tratados como bordas de controles.

Não há restrição adicional sobre os hexadecimais aceitos pelo schema. Paletas
com cores iguais continuam legíveis, mas perdem naturalmente diferenciação de
marca. Um acento textual pode diferir da cor original para alcançar contraste.

Essas verificações numéricas não constituem certificação de toda a página:
gradientes sobre fotografias dependem da imagem e do enquadramento, e exigem
conferência visual em desktop e mobile. Elementos indisponíveis continuam
identificados como desabilitados. O ambiente desta auditoria não disponibilizou
navegador para validar aparência, foco real e composição sobre fotografias.

## Cobertura

Testes cobrem 343 combinações de paleta, as três responsabilidades, valores padrão,
ausência de cores de marca fixas indevidas, escopos das seções renderizadas,
edição/restauração no reducer e salvamento/reabertura/versionamento pelo serviço.
O teste PostgreSQL também confere a paleta persistida e a versão imutável, quando
executado com `PROTOTYPE_TEST_DATABASE_URL` em um banco descartável migrado.
