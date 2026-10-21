import type { HamburgueriaPrototypeDocument as Document } from "../../templates/hamburgueria/schema/hamburgueria.schema";

type Content = Document["content"];
/** Only fields exposed by this editor; images, IDs and product references are excluded. */
type EditableData = {
  business: Pick<Document["business"], "address" | "foundedYear">;
  content: {
    hero: Omit<
      Content["hero"],
      | "image"
      | "eyebrow"
      | "headline"
      | "description"
      | "primaryCtaLabel"
      | "secondaryCtaLabel"
    >;
    menu: Omit<
      Content["menu"],
      "categories" | "products" | "extras" | "defaultCategoryId"
    >;
    qualities: Pick<Content["qualities"], "accessibleLabel">;
    story: Omit<Content["story"], "paragraphs" | "featured"> & {
      featured: Omit<
        Content["story"]["featured"],
        "image" | "productId" | "targetCategoryId"
      >;
    };
    howToOrder: Omit<Content["howToOrder"], "steps">;
    service: Omit<Content["service"], "openingHours" | "delivery"> & {
      delivery: Omit<Content["service"]["delivery"], "areas">;
    };
    reviews: Omit<Content["reviews"], "entries">;
    faq: Omit<Content["faq"], "items">;
    location: Omit<Content["location"], "image">;
    finalCallToAction: Omit<Content["finalCallToAction"], "buttonLabel">;
    footer: Content["footer"];
    demoCopy: Content["demoCopy"];
    interactions: Content["interactions"];
  };
};
type Keys<T> = T extends readonly unknown[]
  ? Exclude<keyof T, keyof unknown[]> & string
  : keyof T & string;
type Paths<T> = {
  [K in Keys<T>]: NonNullable<T[K]> extends object
    ? `${K}.${Paths<NonNullable<T[K]>>}`
    : K;
}[Keys<T>];
type At<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? At<NonNullable<T[K]>, Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;
export type SectionFieldPath = Paths<EditableData>;
export type SectionFieldValue<P extends SectionFieldPath> = At<EditableData, P>;
export type SectionTextPath = {
  [P in SectionFieldPath]: string extends SectionFieldValue<P> ? P : never;
}[SectionFieldPath];
type FieldAction = {
  [P in SectionFieldPath]: {
    type: "sectionField";
    path: P;
    value: SectionFieldValue<P>;
  };
}[SectionFieldPath];

export function sectionField<P extends SectionFieldPath>(
  path: P,
  value: SectionFieldValue<P>,
): FieldAction {
  return { type: "sectionField", path, value } as FieldAction;
}

type Items = {
  reviews: Content["reviews"]["entries"][number];
  faq: Content["faq"]["items"][number];
  qualities: Content["qualities"]["items"][number];
  steps: Content["howToOrder"]["steps"][number];
  areas: Content["service"]["delivery"]["areas"][number];
};
export type SectionList = keyof Items;
export type SectionItem<K extends SectionList> = Items[K];
type VariableList = Exclude<SectionList, "steps">;
export const sectionListRules = {
  reviews: {
    min: 0,
    max: 30,
    path: "content.reviews.entries",
    label: "avaliação",
  },
  faq: { min: 0, max: 40, path: "content.faq.items", label: "pergunta" },
  qualities: {
    min: 1,
    max: 8,
    path: "content.qualities.items",
    label: "diferencial",
  },
  steps: { min: 3, max: 3, path: "content.howToOrder.steps", label: "etapa" },
  areas: {
    min: 1,
    max: 100,
    path: "content.service.delivery.areas",
    label: "área de entrega",
  },
} as const;
type ItemEdit = {
  [K in SectionList]: {
    type: "sectionItem/edit";
    list: K;
    id: string;
    changes: Partial<Omit<Items[K], "id">>;
  };
}[SectionList];
export type SectionStringList = "paragraphs" | "openingHours";
export const sectionStringRules = {
  paragraphs: {
    min: 1,
    max: 8,
    path: "content.story.paragraphs",
    label: "parágrafo",
  },
  openingHours: {
    min: 1,
    max: 14,
    path: "content.service.openingHours",
    label: "horário",
  },
} as const;
export type EditorSectionAction =
  | FieldAction
  | ItemEdit
  | {
      type: "sectionItem/add" | "sectionItem/delete";
      list: VariableList;
      id: string;
    }
  | {
      type: "sectionItem/move";
      list: SectionList;
      id: string;
      direction: -1 | 1;
    }
  | { type: "sectionStrings/add"; list: SectionStringList }
  | {
      type: "sectionStrings/edit";
      list: SectionStringList;
      index: number;
      value: string;
    }
  | { type: "sectionStrings/delete"; list: SectionStringList; index: number }
  | {
      type: "sectionStrings/move";
      list: SectionStringList;
      index: number;
      direction: -1 | 1;
    };

function readPath(root: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      root,
    );
}

export function getSectionField<P extends SectionFieldPath>(
  document: Document,
  path: P,
): SectionFieldValue<P> {
  return readPath(document, path) as SectionFieldValue<P>;
}

export function getSectionItems<K extends SectionList>(
  document: Document,
  list: K,
): Items[K][] {
  return readPath(document, sectionListRules[list].path) as Items[K][];
}

export function getSectionStrings(
  document: Document,
  list: SectionStringList,
): string[] {
  return readPath(document, sectionStringRules[list].path) as string[];
}

function replacePath<T>(root: T, path: string, value: unknown): T {
  const keys = path.split(".");
  function replace(node: unknown, index: number): unknown {
    if (!node || typeof node !== "object") return node;
    const key = keys[index];
    if (["__proto__", "constructor", "prototype"].includes(key)) return node;
    if (
      !Object.hasOwn(node, key) &&
      ![
        "business.address.postalCode",
        "business.foundedYear",
        "content.reviews.ratingSource",
        "content.reviews.countSource",
      ].includes(path)
    )
      return node;
    const result = Array.isArray(node) ? [...node] : { ...node };
    const record = result as Record<string, unknown>;
    record[key] =
      index === keys.length - 1 ? value : replace(record[key], index + 1);
    return result;
  }
  return replace(root, 0) as T;
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (
    index < 0 ||
    index >= items.length ||
    target < 0 ||
    target >= items.length
  )
    return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function reduceEditorSections(
  document: Document,
  action: EditorSectionAction,
): Document {
  if (action.type === "sectionField")
    return replacePath(document, action.path, action.value);
  if (action.type.startsWith("sectionStrings/")) {
    const operation = action as Extract<
      EditorSectionAction,
      { list: SectionStringList }
    >;
    const rules = sectionStringRules[operation.list];
    const items = getSectionStrings(document, operation.list);
    let next = items;
    switch (operation.type) {
      case "sectionStrings/add":
        if (items.length < rules.max) next = [...items, `Novo ${rules.label}`];
        break;
      case "sectionStrings/edit":
        next = items.map((item, index) =>
          index === operation.index ? operation.value : item,
        );
        break;
      case "sectionStrings/delete":
        if (items.length > rules.min)
          next = items.filter((_, index) => index !== operation.index);
        break;
      case "sectionStrings/move":
        next = move(items, operation.index, operation.direction);
        break;
    }
    return replacePath(document, rules.path, next);
  }
  const operation = action as Exclude<
    EditorSectionAction,
    FieldAction | { list: SectionStringList }
  >;
  const rules = sectionListRules[operation.list];
  const items = getSectionItems(document, operation.list);
  let next = items;
  switch (operation.type) {
    case "sectionItem/add": {
      if (
        items.length >= rules.max ||
        items.some((item) => item.id === operation.id)
      )
        return document;
      const defaults = {
        reviews: {
          id: operation.id,
          name: "Novo cliente",
          initials: "NC",
          role: "Cliente",
          quote: "Escreva o depoimento.",
          demonstrative: true,
        },
        faq: {
          id: operation.id,
          question: "Nova pergunta",
          answer: "Escreva a resposta.",
        },
        qualities: {
          id: operation.id,
          title: "Novo diferencial",
          description: "Descreva o diferencial.",
          icon: "fire" as const,
        },
        areas: { id: operation.id, name: "Nova área de entrega", feeCents: 0 },
      };
      next = [...items, defaults[operation.list]];
      break;
    }
    case "sectionItem/edit":
      next = items.map((item) =>
        item.id === operation.id ? { ...item, ...operation.changes } : item,
      );
      break;
    case "sectionItem/delete":
      if (items.length > rules.min)
        next = items.filter((item) => item.id !== operation.id);
      break;
    case "sectionItem/move":
      next = move(
        items,
        items.findIndex((item) => item.id === operation.id),
        operation.direction,
      );
      break;
  }
  return replacePath(document, rules.path, next);
}
