import type { Restaurant } from "../types/restaurant";
import heroImage from "../assets/hero.webp";
import interiorImage from "../assets/interior.webp";
import baconImage from "../assets/bacon.webp";

// Personalize os dados para cada estabelecimento. Em produção, use demo: false.
export const restaurant: Restaurant = {
  demo: true,
  name: "Brasa Burger",
  brandLines: ["BRASA", "BURGER"],
  founded: 2019,
  tagline: "Fome de coisa boa.",
  siteUrl: "https://brasa-burger-breno.brenopereirabetti.chatgpt.site",
  seo: {
    title: "Brasa Burger — Fome de coisa boa",
    description:
      "Brasa Burger: burgers artesanais, cheddar derretido e batata crocante. Conheça o cardápio, a nossa casa e as informações de atendimento desta hamburgueria fictícia.",
  },
  contact: {
    whatsapp: "",
    instagram: "",
    maps: "https://www.google.com/maps/search/?api=1&query=S%C3%A3o+Paulo+Brasil",
    instagramLabel: "@brasaburger.exemplo",
  },
  hero: {
    eyebrow: "Fogo aceso. Fome resolvida.",
    headline: ["NA BRASA.", "NO CAPRICHO."],
    description: [
      "Carne suculenta, queijo derretendo e aquele primeiro",
      " pedaço que já dá vontade de pedir de novo.",
    ],
    image: heroImage.src,
    imageAlt:
      "Hambúrguer artesanal com bacon, cheddar derretido, alface e tomate em um pão com gergelim",
    hours: "Ter. a dom., 18h às 23h",
    service: "Delivery e retirada",
  },
  location: {
    street: "Rua das Brasas, 180",
    neighborhood: "Vila Brasa",
    city: "São Paulo",
    state: "SP",
    mapRoad: "Rua das Brasas",
    mapAvenue: "Av. do Sabor",
    image: interiorImage.src,
    imageAlt:
      "Ambiente ilustrativo da Brasa Burger com mesas de madeira, bancos amarelos e iluminação acolhedora",
  },
  openingHours: [
    "Terça a quinta e domingo: 18h às 23h",
    "Sexta e sábado: 18h à meia-noite",
    "Segunda: dia de descansar a chapa",
  ],
  orderingHoursNote: "Delivery e retirada encerram 30 min antes do salão.",
  delivery: {
    neighborhoods: "Vila Brasa, Jardim do Fogo e Centro.",
    priceRange: "Taxa entre R$ 5,90 e R$ 9,90.",
    minimumFee: 5.9,
    estimate: "35–50 min",
    pickupEstimate: "25–35 min",
  },
  paymentMethods: "Pix, crédito e débito",
  story: [
    "Em 2019, uma churrasqueira, uma receita de família e uma vontade: fazer o burger que a gente queria comer.",
    "Hoje, a Brasa continua com o mesmo ritual. Carne fresca, pão macio, molho da casa e tempo para fazer direito. Porque uma boa mordida muda o dia.",
  ],
  featuredCombo: {
    image: baconImage.src,
    imageAlt: "Burger de bacon e cheddar para acompanhar uma porção de fritas",
    description: ["Brasa Clássico + fritas 100 g", "+ refrigerante 350 ml."],
    price: 39.9,
  },
  reviews: {
    rating: 4.9,
    count: 800,
    entries: [
      {
        initials: "MC",
        name: "Marina Costa",
        role: "Time do delivery",
        quote:
          "O bacon veio crocante de verdade e a carne no ponto. Já virou o pedido oficial da sexta aqui em casa.",
      },
      {
        initials: "RL",
        name: "Rafael Lima",
        role: "Cliente da casa",
        quote:
          "Fui pelo burger e fiquei pela batata. Atendimento de quem gosta do que faz. Dá vontade de voltar no dia seguinte.",
      },
      {
        initials: "BS",
        name: "Beatriz Santos",
        role: "Fã do Verde Brasa",
        quote:
          "Finalmente um vegetariano com personalidade! O de grão-de-bico com abacate ganhou meu coração.",
      },
    ],
  },
  extras: [
    {
      name: "Cheddar extra",
      price: 3,
    },
    {
      name: "Bacon extra",
      price: 5,
    },
    {
      name: "Burger 100 g extra",
      price: 8,
    },
    {
      name: "Molho da casa 30 g",
      price: 2.5,
    },
  ],
  faq: [
    {
      question: "Quais são as formas de pagamento?",
      answer:
        "Na nossa hamburgueria fictícia, aceitamos Pix, cartões de crédito e débito. Nesta demonstração, nenhum pagamento é solicitado ou processado.",
    },
    {
      question: "Vocês entregam no meu bairro?",
      answer:
        "Atendemos Vila Brasa (R$ 5,90), Jardim do Fogo (R$ 7,90) e Centro (R$ 9,90). Consulte a disponibilidade no atendimento. Bairros e taxas são fictícios.",
    },
    {
      question: "Posso personalizar meu burger?",
      answer:
        "Sim! Peça a retirada de ingredientes diretamente à equipe. Temos adicionais de cheddar, bacon, carne e molho, com os preços informados abaixo do cardápio.",
    },
    {
      question: "Tem opção vegetariana?",
      answer:
        "Temos o Verde Brasa, com burger de grão-de-bico, abacate e molho de ervas. Ele contém pão com glúten e molho com leite e ovos. O preparo compartilha utensílios com os demais produtos.",
    },
    {
      question: "Qual o prazo de entrega e retirada?",
      answer:
        "A estimativa é de 35 a 50 minutos para entrega e de 25 a 35 minutos para retirada. Em uma operação real, os prazos dependem do movimento e seriam confirmados no atendimento.",
    },
    {
      question: "Posso reservar uma mesa?",
      answer:
        "Na proposta da nossa casa, o salão atende por ordem de chegada. Para grupos com mais de 6 pessoas, o atendimento pelo WhatsApp confirma a disponibilidade.",
    },
    {
      question: "Esta hamburgueria recebe pedidos de verdade?",
      answer:
        "Esta é uma landing page demonstrativa. Marca, produtos, preços, endereço e avaliações são fictícios. Os botões de pedido demonstram o contato pelo WhatsApp; nenhum pedido é enviado ou cobrado nesta versão.",
      demoOnly: true,
    },
  ],
};
