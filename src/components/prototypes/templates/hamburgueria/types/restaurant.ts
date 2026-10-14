export type MenuCategory =
  "burgers" | "combos" | "sides" | "drinks" | "desserts";

export interface Product {
  id: string;
  category: MenuCategory;
  name: string;
  description: string;
  price: number;
  image?: string;
  icon?: "fries" | "cup" | "dessert";
  badge?: string;
  vegetarian?: boolean;
  allergens?: string;
}

export interface Restaurant {
  demo: boolean;
  name: string;
  brandLines: [string, string];
  founded: number;
  tagline: string;
  siteUrl: string;
  seo: { title: string; description: string };
  contact: {
    whatsapp: string;
    instagram: string;
    instagramLabel: string;
    maps: string;
  };
  hero: {
    eyebrow: string;
    headline: [string, string];
    description: [string, string];
    image: string;
    imageAlt: string;
    hours: string;
    service: string;
  };
  location: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    mapRoad: string;
    mapAvenue: string;
    image: string;
    imageAlt: string;
    postalCode?: string;
  };
  openingHours: string[];
  orderingHoursNote: string;
  delivery: {
    neighborhoods: string;
    priceRange: string;
    minimumFee: number;
    estimate: string;
    pickupEstimate: string;
  };
  paymentMethods: string;
  story: string[];
  featuredCombo: {
    image: string;
    imageAlt: string;
    description: [string, string];
    price: number;
  };
  reviews: {
    rating: number;
    count: number;
    entries: { initials: string; name: string; role: string; quote: string }[];
  };
  extras: { name: string; price: number }[];
  faq: { question: string; answer: string; demoOnly?: boolean }[];
}
