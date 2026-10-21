import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import { hamburgueriaPrototypeDocumentSchema } from "../schema/hamburgueria.schema";

const templateImage = (key: string, alt: string) => ({
  source: "template" as const,
  key,
  alt,
});

export const brasaBurgerDefaultDocument: HamburgueriaPrototypeDocument =
  hamburgueriaPrototypeDocumentSchema.parse({
    schemaVersion: 1,
    template: { id: "brasa-burger", version: 1 },
    category: "hamburgueria",
    locale: "pt-BR",
    currency: "BRL",
    business: {
      name: "Brasa Burger",
      tagline: "Fome de coisa boa.",
      brandLines: ["BRASA", "BURGER"],
      foundedYear: 2019,
      address: {
        street: "Rua das Brasas, 180",
        neighborhood: "Vila Brasa",
        city: "São Paulo",
        state: "SP",
      },
    },
    seo: {
      title: "Brasa Burger — Fome de coisa boa",
      description:
        "Brasa Burger: burgers artesanais, cheddar derretido e batata crocante. Conheça o cardápio, a nossa casa e as informações de atendimento da hamburgueria.",
      canonicalUrl: "",
    },
    appearance: {
      colors: { primary: "#f5bb16", secondary: "#141413", tertiary: "#f6f3ec" },
      fonts: { body: "barlow", display: "barlow-condensed", hand: "caveat" },
    },
    contact: {
      whatsapp: "",
      instagramUrl: "",
      instagramLabel: "",
      mapsUrl: "",
    },
    demo: { enabled: true },
    sections: {
      hero: true,
      qualities: true,
      menu: true,
      story: true,
      howToOrder: true,
      reviews: true,
      location: true,
      faq: true,
      finalCallToAction: true,
    },
    content: {
      header: {
        navigation: [
          { target: "hero", label: "Início" },
          { target: "menu", label: "Cardápio" },
          { target: "story", label: "Nossa brasa" },
          { target: "location", label: "Onde estamos" },
          { target: "faq", label: "Dúvidas" },
        ],
        menuButtonLabel: "Ver cardápio",
      },
      hero: {
        eyebrow: "Fogo aceso. Fome resolvida.",
        headline: ["NA BRASA.", "NO CAPRICHO."],
        description: [
          "Carne suculenta, queijo derretendo e aquele primeiro",
          " pedaço que já dá vontade de pedir de novo.",
        ],
        image: templateImage(
          "hero",
          "Hambúrguer artesanal com bacon, cheddar derretido, alface e tomate em um pão com gergelim",
        ),
        primaryCtaLabel: "Ver cardápio e pedir",
        secondaryCtaLabel: "Conhecer a casa",
        reviewStarsLabel: "{rating} de 5 estrelas",
        reviewCountLabel: "Mais de {count} boas mordidas",
        hoursSummary: "Ter. a dom., 18h às 23h",
        serviceSummary: "Delivery e retirada",
        badgeText: "100%",
        badgeLines: ["FEITO", "NA BRASA"],
        bottomNote: "Feito na hora. Do nosso jeito. Pra sua fome.",
      },
      qualities: {
        accessibleLabel: "O jeito Brasa de fazer",
        items: [
          {
            id: "brasa-de-verdade",
            icon: "fire",
            title: "Brasa de verdade",
            description: "Carne fresca, sabor de fogo.",
          },
          {
            id: "crocancia-no-ponto",
            icon: "fries",
            title: "Crocância no ponto",
            description: "Batata sequinha a cada pedido.",
          },
          {
            id: "feito-na-hora",
            icon: "burger",
            title: "Feito na hora",
            description: "Da chapa direto para você.",
          },
          {
            id: "capricho",
            icon: "leaf",
            title: "Capricho do início ao fim",
            description: "Ingredientes escolhidos a dedo.",
          },
        ],
      },
      menu: {
        eyebrow: "Escolha sua próxima mordida",
        title: "OS FAVORITOS DA CASA",
        helpLinkLabel: "Como fazer seu pedido",
        note: "Feitos na hora, sempre.",
        categoryGroupLabel: "Categorias do cardápio",
        defaultCategoryId: "burgers",
        categories: [
          { id: "burgers", label: "Burgers" },
          { id: "combos", label: "Combos" },
          { id: "sides", label: "Acompanhamentos" },
          { id: "drinks", label: "Bebidas" },
          { id: "desserts", label: "Sobremesas" },
        ],
        products: [
          {
            id: "classico",
            categoryId: "burgers",
            name: "BRASA CLÁSSICO",
            description:
              "Pão brioche, burger de 160 g, cheddar, alface, tomate, cebola roxa e maionese da casa.",
            priceCents: 2790,
            image: templateImage(
              "classic",
              "brasa clássico: Pão brioche, burger de 160 g, cheddar, alface, tomate, cebola roxa e maionese da casa.",
            ),
            badge: "O queridinho da casa",
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "bacon",
            categoryId: "burgers",
            name: "BACON NA BRASA",
            description:
              "Dois burgers de 100 g, cheddar duplo, bacon crocante, cebola caramelizada e barbecue.",
            priceCents: 3690,
            image: templateImage(
              "bacon",
              "bacon na brasa: Dois burgers de 100 g, cheddar duplo, bacon crocante, cebola caramelizada e barbecue.",
            ),
            badge: "Para quem ama bacon",
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "duplo",
            categoryId: "burgers",
            name: "BRASA DUPLO",
            description:
              "Dois burgers de 100 g, cheddar, bacon, alface, tomate, cebola roxa e molho especial.",
            priceCents: 3490,
            image: {
              ...templateImage(
                "hero",
                "brasa duplo: Dois burgers de 100 g, cheddar, bacon, alface, tomate, cebola roxa e molho especial.",
              ),
              focalPoint: { x: 78, y: 50 },
            },
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "verde",
            categoryId: "burgers",
            name: "VERDE BRASA",
            description:
              "Burger de grão-de-bico, abacate, alface, tomate, cebola roxa e maionese de ervas.",
            priceCents: 2990,
            image: templateImage(
              "veggie",
              "verde brasa: Burger de grão-de-bico, abacate, alface, tomate, cebola roxa e maionese de ervas.",
            ),
            badge: "Vegetariano",
            vegetarian: true,
            allergens: "Contém glúten, leite e ovos. Preparo compartilhado.",
          },
          {
            id: "combo-classico",
            categoryId: "combos",
            name: "COMBO CLÁSSICO",
            description:
              "Brasa Clássico + fritas 100 g + refrigerante lata 350 ml. O trio que não tem erro.",
            priceCents: 3990,
            image: templateImage(
              "classic",
              "combo clássico: Brasa Clássico + fritas 100 g + refrigerante lata 350 ml. O trio que não tem erro.",
            ),
            badge: "O combo da casa",
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "combo-bacon",
            categoryId: "combos",
            name: "COMBO BACON",
            description:
              "Bacon na Brasa + fritas 100 g + refrigerante lata 350 ml. Para uma fome de respeito.",
            priceCents: 4890,
            image: templateImage(
              "bacon",
              "combo bacon: Bacon na Brasa + fritas 100 g + refrigerante lata 350 ml. Para uma fome de respeito.",
            ),
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "combo-dupla",
            categoryId: "combos",
            name: "COMBO DA DUPLA",
            description:
              "Dois Brasas Clássicos + fritas 200 g + dois refrigerantes 350 ml. Melhor com companhia.",
            priceCents: 7490,
            image: templateImage(
              "classic",
              "combo da dupla: Dois Brasas Clássicos + fritas 200 g + dois refrigerantes 350 ml. Melhor com companhia.",
            ),
            badge: "Serve 2 pessoas",
            allergens: "Contém glúten, leite e ovos.",
          },
          {
            id: "fritas",
            categoryId: "sides",
            name: "FRITAS DA CASA",
            description:
              "Batatas douradas, crocantes e sequinhas. Porção de 150 g com maionese da casa.",
            priceCents: 1490,
            icon: "fries",
            allergens: "Molho contém ovos. Fritadeira compartilhada.",
          },
          {
            id: "fritas-cheddar",
            categoryId: "sides",
            name: "FRITAS CHEDDAR & BACON",
            description:
              "Batatas 200 g, cheddar cremoso e bacon crocante. Para dividir. Ou não.",
            priceCents: 2490,
            icon: "fries",
            allergens: "Contém leite. Fritadeira compartilhada.",
          },
          {
            id: "onion",
            categoryId: "sides",
            name: "ONION RINGS",
            description:
              "Anéis de cebola empanados e dourados, com molho barbecue. Porção de 150 g.",
            priceCents: 1890,
            icon: "fries",
            allergens: "Contém glúten. Fritadeira compartilhada.",
          },
          {
            id: "refri",
            categoryId: "drinks",
            name: "REFRIGERANTE",
            description:
              "Lata de 350 ml bem gelada. Cola, guaraná ou limão. Consulte opções sem açúcar.",
            priceCents: 690,
            icon: "cup",
          },
          {
            id: "suco",
            categoryId: "drinks",
            name: "SUCO NATURAL",
            description:
              "Laranja ou limão espremidos na hora. Copo de 400 ml, com ou sem açúcar.",
            priceCents: 1090,
            icon: "cup",
          },
          {
            id: "agua",
            categoryId: "drinks",
            name: "ÁGUA MINERAL",
            description:
              "Garrafa de 500 ml, com ou sem gás. Do jeito que você preferir.",
            priceCents: 490,
            icon: "cup",
          },
          {
            id: "brownie",
            categoryId: "desserts",
            name: "BROWNIE DA BRASA",
            description:
              "Brownie de chocolate quentinho com uma bola de sorvete de baunilha. Porção de 180 g.",
            priceCents: 1990,
            icon: "dessert",
            badge: "Final feliz",
            allergens: "Contém glúten, leite, ovos e castanhas.",
          },
          {
            id: "shake",
            categoryId: "desserts",
            name: "MILK-SHAKE",
            description:
              "Sorvete batido na hora. Chocolate, morango ou baunilha. Copo de 400 ml.",
            priceCents: 1890,
            icon: "cup",
            allergens: "Contém leite. Pode conter glúten e ovos.",
          },
        ],
        extrasHeading: "Deixe ainda mais seu:",
        extras: [
          { id: "cheddar-extra", name: "Cheddar extra", priceCents: 300 },
          { id: "bacon-extra", name: "Bacon extra", priceCents: 500 },
          { id: "burger-extra", name: "Burger 100 g extra", priceCents: 800 },
          { id: "molho-extra", name: "Molho da casa 30 g", priceCents: 250 },
        ],
        vegetarianNote: "Tem opção vegetariana, sim.",
        vegetarianLabel: "Vegetariano",
        customizationNote:
          "Quer tirar algum ingrediente? É só avisar no atendimento.",
        orderButtonLabel: "Pedir pelo WhatsApp",
      },
      service: {
        modes: { delivery: true, pickup: true, dineIn: true },
        openingHours: [
          "Terça a quinta e domingo: 18h às 23h",
          "Sexta e sábado: 18h à meia-noite",
          "Segunda: dia de descansar a chapa",
        ],
        orderingHoursNote:
          "Delivery e retirada encerram 30 min antes do salão.",
        delivery: {
          areas: [
            { id: "vila-brasa", name: "Vila Brasa", feeCents: 590 },
            { id: "jardim-do-fogo", name: "Jardim do Fogo", feeCents: 790 },
            { id: "centro", name: "Centro", feeCents: 990 },
          ],
          neighborhoodsSummary: "Vila Brasa, Jardim do Fogo e Centro.",
          priceRangeText: "Taxa entre R$ 5,90 e R$ 9,90.",
          minimumFeeCents: 590,
          estimate: "35–50 min",
          pickupEstimate: "25–35 min",
        },
        paymentMethodsText: "Pix, crédito e débito",
        pickupFeeText: "Retirada sem taxa",
      },
      story: {
        featured: {
          productId: "combo-classico",
          image: templateImage(
            "bacon",
            "Burger de bacon e cheddar para acompanhar uma porção de fritas",
          ),
          eyebrow: "Sua fome merece o combo.",
          headline: ["BURGER.", "FRITAS.", "FELICIDADE."],
          description: [
            "Brasa Clássico + fritas 100 g",
            "+ refrigerante 350 ml.",
          ],
          priceLabel: "O trio por",
          ctaLabel: "Conhecer os combos",
          targetCategoryId: "combos",
        },
        eyebrow: "Nossa casa, nossa essência",
        headline: ["A GENTE LEVA", "HAMBÚRGUER", "A SÉRIO."],
        paragraphs: [
          "Em 2019, uma churrasqueira, uma receita de família e uma vontade: fazer o burger que a gente queria comer.",
          "Hoje, a Brasa continua com o mesmo ritual. Carne fresca, pão macio, molho da casa e tempo para fazer direito. Porque uma boa mordida muda o dia.",
        ],
        signature: ["Fogo no preparo.", "Carinho em cada pedido."],
      },
      howToOrder: {
        eyebrow: "Da nossa chapa para você",
        title: "CHEGOU A HORA DE MATAR A FOME.",
        steps: [
          {
            id: "escolha",
            title: "Escolha seus favoritos",
            body: "Explore os burgers, acompanhamentos e bebidas do cardápio. Já sabe qual vai ser?",
          },
          {
            id: "fale-conosco",
            title: "Fale com a nossa equipe",
            body: "Peça pelo WhatsApp ou direto no balcão. Conte como você gosta e a gente capricha.",
          },
          {
            id: "primeira-mordida",
            title: "Pronto para a primeira mordida",
            body: "Entregamos em {deliveryEstimate}. Prefere buscar? A retirada fica pronta em {pickupEstimate}.",
          },
        ],
        minimumDeliveryLabel: "Entrega a partir de",
        atendimentoLinkLabel: "Ver atendimento",
      },
      reviews: {
        eyebrow: "Quem prova, conta",
        title: "É BOM. MAS PODE PERGUNTAR.",
        rating: 4.9,
        count: 800,
        ratingSource: "demo",
        countSource: "demo",
        starsLabel: "{rating} de 5 estrelas",
        countLabel: "Mais de {count} avaliações",
        entries: [
          {
            id: "marina-costa",
            demonstrative: true,
            rating: 5,
            initials: "MC",
            name: "Marina Costa",
            role: "Time do delivery",
            quote:
              "O bacon veio crocante de verdade e a carne no ponto. Já virou o pedido oficial da sexta aqui em casa.",
          },
          {
            id: "rafael-lima",
            demonstrative: true,
            rating: 5,
            initials: "RL",
            name: "Rafael Lima",
            role: "Cliente da casa",
            quote:
              "Fui pelo burger e fiquei pela batata. Atendimento de quem gosta do que faz. Dá vontade de voltar no dia seguinte.",
          },
          {
            id: "beatriz-santos",
            demonstrative: true,
            rating: 5,
            initials: "BS",
            name: "Beatriz Santos",
            role: "Fã do Verde Brasa",
            quote:
              "Finalmente um vegetariano com personalidade! O de grão-de-bico com abacate ganhou meu coração.",
          },
        ],
      },
      location: {
        eyebrow: "Puxa uma cadeira",
        headline: ["O MELHOR CAMINHO", "TERMINA EM BURGER."],
        description:
          "Uma casa descontraída, brasa acesa e espaço para reunir a turma. Ou levar esse momento para casa.",
        addressHeading: "Nosso cantinho",
        hoursHeading: "Quando a brasa acende",
        deliveryHeading: "A gente chega até você",
        image: templateImage(
          "interior",
          "Ambiente ilustrativo da Brasa Burger com mesas de madeira, bancos amarelos e iluminação acolhedora",
        ),
        mapRoad: "Rua das Brasas",
        mapAvenue: "Av. do Sabor",
        mapPlaceTagline: "Seu próximo lugar favorito.",
        mapAccessibleLabel: "Localização de {businessName}",
        mapLinkLabel: "Ver localização no mapa",
        mapCaption: "",
        orderLinkLabel: "Pedir pelo WhatsApp",
        socialLinkPrefix: "Instagram",
      },
      faq: {
        eyebrow: "Antes da primeira mordida",
        headline: ["FICOU COM", "ALGUMA DÚVIDA?"],
        intro: ["A fome a gente resolve.", "As dúvidas também."],
        items: [
          {
            id: "pagamento",
            question: "Quais são as formas de pagamento?",
            answer:
              "Consulte as formas de pagamento disponíveis com nossa equipe ao fazer seu pedido.",
          },
          {
            id: "entrega",
            question: "Vocês entregam no meu bairro?",
            answer:
              "Informe seu endereço no atendimento para consultar a disponibilidade e a taxa de entrega.",
          },
          {
            id: "personalizar",
            question: "Posso personalizar meu burger?",
            answer:
              "Sim! Peça a retirada de ingredientes diretamente à equipe. Temos adicionais de cheddar, bacon, carne e molho, com os preços informados abaixo do cardápio.",
          },
          {
            id: "vegetariano",
            question: "Tem opção vegetariana?",
            answer:
              "Temos o Verde Brasa, com burger de grão-de-bico, abacate e molho de ervas. Ele contém pão com glúten e molho com leite e ovos. O preparo compartilha utensílios com os demais produtos.",
          },
          {
            id: "prazo",
            question: "Qual o prazo de entrega e retirada?",
            answer:
              "Confirme o prazo de preparo e as opções de recebimento com nossa equipe ao fazer seu pedido.",
          },
          {
            id: "reserva",
            question: "Posso reservar uma mesa?",
            answer:
              "Na proposta da nossa casa, o salão atende por ordem de chegada. Para grupos com mais de 6 pessoas, o atendimento pelo WhatsApp confirma a disponibilidade.",
          },
          {
            id: "demonstracao",
            question: "Esta hamburgueria recebe pedidos de verdade?",
            answer:
              "Esta é uma prévia com conteúdo de exemplo. Produtos, preços, depoimentos e informações de atendimento precisam ser revisados. Quando configurado, o WhatsApp abre o contato informado; a página não processa pagamentos.",
            demoOnly: true,
          },
        ],
      },
      finalCallToAction: {
        eyebrow: "A brasa já está acesa.",
        title: "SÓ FALTA VOCÊ ESCOLHER.",
        buttonLabel: "Pedir pelo WhatsApp",
      },
      footer: {
        navigationHeading: "Explore a casa",
        navigationLinks: [
          { target: "menu", label: "Cardápio" },
          { target: "story", label: "Nossa história" },
          { target: "location", label: "Onde estamos" },
        ],
        serviceHeading: "Acenda a fome",
        faqLinkLabel: "Dúvidas frequentes",
        serviceLines: [
          "Delivery, retirada e salão.",
          "Terça a domingo, a partir das 18h.",
        ],
        signature: ["Da primeira mordida", "ao último guardanapo."],
        buttonLabel: "Escolher meu burger",
        copyrightYear: 2026,
      },
      demoCopy: {
        orderDialogTitle: "DEU VONTADE, NÉ?",
        orderDialogMessage:
          "Esta é uma hamburgueria fictícia. Os pratos e preços são ilustrativos, e não recebemos pedidos. Em uma loja real, você falaria com a equipe pelo WhatsApp.",
        socialDialogTitle: "PERFIL NÃO CONFIGURADO",
        socialDialogMessage:
          "O perfil nas redes sociais da {businessName} ainda não foi configurado nesta prévia. Continue explorando a página.",
        reviewDisclaimer:
          "Os depoimentos identificados como ilustrativos são exemplos do template e devem ser substituídos por relatos reais antes da publicação.",
        locationDisclaimer:
          "Mapa ilustrativo · confirme o endereço no link de localização",
        contactDisclaimer: "Canal ilustrativo · marca fictícia",
        footerDisclaimer:
          "Prévia demonstrativa com conteúdos de exemplo e imagens ilustrativas. Revise as informações antes da publicação.",
      },
      interactions: {
        orderMessage: "Olá, {businessName}! Gostaria de fazer um pedido.",
        productOrderMessage:
          "Olá, {businessName}! Gostaria de pedir {productName} ({price}).",
      },
    },
  });
