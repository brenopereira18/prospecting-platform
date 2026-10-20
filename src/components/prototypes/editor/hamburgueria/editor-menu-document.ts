import { HAMBURGUERIA_MENU_LIMITS, type HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";

type Menu = HamburgueriaPrototypeDocument["content"]["menu"];
export type MenuProduct = Menu["products"][number];
export type MenuExtra = Menu["extras"][number];
type Direction = -1 | 1;

/** Parse decimal digits directly: no floating point multiplication or rounding. */
export function parseReais(input: string): number | null {
  let value = input.trim().replace(/^R\$\s*/, "");
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)) value = value.replaceAll(".", "");
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(`${match[1]}${(match[2] ?? "").padEnd(2, "0")}`);
  return Number.isSafeInteger(cents) && cents <= HAMBURGUERIA_MENU_LIMITS.priceCents ? cents : null;
}

export function formatEditableReais(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

export type EditorMenuAction =
  | { type: "menu/category/add"; id: string }
  | { type: "menu/category/edit"; id: string; label: string }
  | { type: "menu/category/delete"; id: string }
  | { type: "menu/category/move"; id: string; direction: Direction }
  | { type: "menu/product/add"; id: string; categoryId: string }
  | { type: "menu/product/edit"; id: string; changes: Partial<Pick<MenuProduct, "name" | "description" | "priceCents" | "categoryId" | "badge" | "allergens" | "vegetarian" | "icon">> }
  | { type: "menu/product/delete"; id: string }
  | { type: "menu/product/move"; id: string; direction: Direction; categoryId?: string }
  | { type: "menu/extra/add"; id: string }
  | { type: "menu/extra/edit"; id: string; changes: Partial<Pick<MenuExtra, "name" | "priceCents">> }
  | { type: "menu/extra/delete"; id: string }
  | { type: "menu/extra/move"; id: string; direction: Direction };

function moveItem<T extends { id: string }>(items: T[], id: string, direction: Direction, include: (item: T) => boolean = () => true) {
  const indexes = items.flatMap((item, index) => include(item) ? [index] : []);
  const position = indexes.findIndex(index => items[index].id === id);
  const from = indexes[position];
  const to = indexes[position + direction];
  if (from === undefined || to === undefined) return items;
  const result = [...items];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

function validPrice(value: number | undefined) {
  return value === undefined || (Number.isInteger(value) && value >= 0 && value <= HAMBURGUERIA_MENU_LIMITS.priceCents);
}

export function reduceEditorMenu(document: HamburgueriaPrototypeDocument, action: EditorMenuAction): HamburgueriaPrototypeDocument {
  const original = document.content.menu;
  let menu = original;
  switch (action.type) {
    case "menu/category/add":
      if (menu.categories.length >= HAMBURGUERIA_MENU_LIMITS.categories || menu.categories.some(item => item.id === action.id)) return document;
      menu = { ...menu, categories: [...menu.categories, { id: action.id, label: "Nova categoria" }] };
      break;
    case "menu/category/edit":
      menu = { ...menu, categories: menu.categories.map(item => item.id === action.id ? { ...item, label: action.label } : item) };
      break;
    case "menu/category/delete":
      menu = { ...menu, categories: menu.categories.filter(item => item.id !== action.id), products: menu.products.filter(item => item.categoryId !== action.id) };
      break;
    case "menu/category/move":
      menu = { ...menu, categories: moveItem(menu.categories, action.id, action.direction) };
      break;
    case "menu/product/add":
      if (!menu.categories.some(item => item.id === action.categoryId) || menu.products.length >= HAMBURGUERIA_MENU_LIMITS.products || menu.products.some(item => item.id === action.id)) return document;
      menu = { ...menu, products: [...menu.products, { id: action.id, categoryId: action.categoryId, name: "Novo produto", description: "Descreva o produto.", priceCents: 0, icon: "burger" }] };
      break;
    case "menu/product/edit":
      if ((action.changes.categoryId !== undefined && !menu.categories.some(item => item.id === action.changes.categoryId)) || !validPrice(action.changes.priceCents)) return document;
      menu = { ...menu, products: menu.products.map(item => item.id === action.id ? { ...item, ...action.changes } : item) };
      break;
    case "menu/product/delete":
      menu = { ...menu, products: menu.products.filter(item => item.id !== action.id) };
      break;
    case "menu/product/move":
      menu = { ...menu, products: moveItem(menu.products, action.id, action.direction, item => !action.categoryId || item.categoryId === action.categoryId) };
      break;
    case "menu/extra/add":
      if (menu.extras.length >= HAMBURGUERIA_MENU_LIMITS.extras || menu.extras.some(item => item.id === action.id)) return document;
      menu = { ...menu, extras: [...menu.extras, { id: action.id, name: "Novo adicional", priceCents: 0 }] };
      break;
    case "menu/extra/edit":
      if (!validPrice(action.changes.priceCents)) return document;
      menu = { ...menu, extras: menu.extras.map(item => item.id === action.id ? { ...item, ...action.changes } : item) };
      break;
    case "menu/extra/delete":
      menu = { ...menu, extras: menu.extras.filter(item => item.id !== action.id) };
      break;
    case "menu/extra/move":
      menu = { ...menu, extras: moveItem(menu.extras, action.id, action.direction) };
      break;
  }
  const defaultCategoryId = menu.categories.find(item => item.id === menu.defaultCategoryId)?.id ?? menu.categories[0]?.id ?? null;
  const featured = document.content.story.featured;
  const product = menu.products.find(item => item.id === featured.productId);
  return {
    ...document,
    content: {
      ...document.content,
      menu: { ...menu, defaultCategoryId },
      story: { ...document.content.story, featured: { ...featured, productId: product?.id ?? null, targetCategoryId: product?.categoryId ?? null } },
    },
  };
}
