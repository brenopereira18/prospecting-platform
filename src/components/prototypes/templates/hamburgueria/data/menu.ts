import type { Product, MenuCategory } from "../types/restaurant";
import classicImage from "../assets/classic.webp";
import baconImage from "../assets/bacon.webp";
import heroImage from "../assets/hero.webp";
import veggieImage from "../assets/veggie.webp";

export const categories: { id: MenuCategory; label: string }[] = [
  {
    id: "burgers",
    label: "Burgers",
  },
  {
    id: "combos",
    label: "Combos",
  },
  {
    id: "sides",
    label: "Acompanhamentos",
  },
  {
    id: "drinks",
    label: "Bebidas",
  },
  {
    id: "desserts",
    label: "Sobremesas",
  },
];

export const products: Product[] = [
  {
    id: "classico",
    category: "burgers",
    name: "BRASA CLÁSSICO",
    description:
      "Pão brioche, burger de 160 g, cheddar, alface, tomate, cebola roxa e maionese da casa.",
    price: 27.9,
    image: classicImage.src,
    badge: "O queridinho da casa",
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "bacon",
    category: "burgers",
    name: "BACON NA BRASA",
    description:
      "Dois burgers de 100 g, cheddar duplo, bacon crocante, cebola caramelizada e barbecue.",
    price: 36.9,
    image: baconImage.src,
    badge: "Para quem ama bacon",
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "duplo",
    category: "burgers",
    name: "BRASA DUPLO",
    description:
      "Dois burgers de 100 g, cheddar, bacon, alface, tomate, cebola roxa e molho especial.",
    price: 34.9,
    image: heroImage.src,
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "verde",
    category: "burgers",
    name: "VERDE BRASA",
    description:
      "Burger de grão-de-bico, abacate, alface, tomate, cebola roxa e maionese de ervas.",
    price: 29.9,
    image: veggieImage.src,
    badge: "Vegetariano",
    vegetarian: true,
    allergens: "Contém glúten, leite e ovos. Preparo compartilhado.",
  },
  {
    id: "combo-classico",
    category: "combos",
    name: "COMBO CLÁSSICO",
    description:
      "Brasa Clássico + fritas 100 g + refrigerante lata 350 ml. O trio que não tem erro.",
    price: 39.9,
    image: classicImage.src,
    badge: "O combo da casa",
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "combo-bacon",
    category: "combos",
    name: "COMBO BACON",
    description:
      "Bacon na Brasa + fritas 100 g + refrigerante lata 350 ml. Para uma fome de respeito.",
    price: 48.9,
    image: baconImage.src,
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "combo-dupla",
    category: "combos",
    name: "COMBO DA DUPLA",
    description:
      "Dois Brasas Clássicos + fritas 200 g + dois refrigerantes 350 ml. Melhor com companhia.",
    price: 74.9,
    image: classicImage.src,
    badge: "Serve 2 pessoas",
    allergens: "Contém glúten, leite e ovos.",
  },
  {
    id: "fritas",
    category: "sides",
    name: "FRITAS DA CASA",
    description:
      "Batatas douradas, crocantes e sequinhas. Porção de 150 g com maionese da casa.",
    price: 14.9,
    icon: "fries",
    allergens: "Molho contém ovos. Fritadeira compartilhada.",
  },
  {
    id: "fritas-cheddar",
    category: "sides",
    name: "FRITAS CHEDDAR & BACON",
    description:
      "Batatas 200 g, cheddar cremoso e bacon crocante. Para dividir. Ou não.",
    price: 24.9,
    icon: "fries",
    allergens: "Contém leite. Fritadeira compartilhada.",
  },
  {
    id: "onion",
    category: "sides",
    name: "ONION RINGS",
    description:
      "Anéis de cebola empanados e dourados, com molho barbecue. Porção de 150 g.",
    price: 18.9,
    icon: "fries",
    allergens: "Contém glúten. Fritadeira compartilhada.",
  },
  {
    id: "refri",
    category: "drinks",
    name: "REFRIGERANTE",
    description:
      "Lata de 350 ml bem gelada. Cola, guaraná ou limão. Consulte opções sem açúcar.",
    price: 6.9,
    icon: "cup",
  },
  {
    id: "suco",
    category: "drinks",
    name: "SUCO NATURAL",
    description:
      "Laranja ou limão espremidos na hora. Copo de 400 ml, com ou sem açúcar.",
    price: 10.9,
    icon: "cup",
  },
  {
    id: "agua",
    category: "drinks",
    name: "ÁGUA MINERAL",
    description:
      "Garrafa de 500 ml, com ou sem gás. Do jeito que você preferir.",
    price: 4.9,
    icon: "cup",
  },
  {
    id: "brownie",
    category: "desserts",
    name: "BROWNIE DA BRASA",
    description:
      "Brownie de chocolate quentinho com uma bola de sorvete de baunilha. Porção de 180 g.",
    price: 19.9,
    icon: "dessert",
    badge: "Final feliz",
    allergens: "Contém glúten, leite, ovos e castanhas.",
  },
  {
    id: "shake",
    category: "desserts",
    name: "MILK-SHAKE",
    description:
      "Sorvete batido na hora. Chocolate, morango ou baunilha. Copo de 400 ml.",
    price: 18.9,
    icon: "cup",
    allergens: "Contém leite. Pode conter glúten e ovos.",
  },
];
