export const PROTOTYPES_PER_PAGE = 20;

export function parsePrototypePage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return { page: 1, valid: value === undefined };
  }
  const page = Number(value);
  return Number.isSafeInteger(page)
    ? { page, valid: true }
    : { page: 1, valid: false };
}

export function prototypePageHref(page: number, selectedPrototypeId?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (selectedPrototypeId) params.set("prototype", selectedPrototypeId);
  const query = params.toString();
  return query ? `/prototipos?${query}` : "/prototipos";
}

export function getPrototypePageRedirect(
  page: number,
  totalCount: number,
  hasItems = true,
) {
  const totalPages = Math.max(1, Math.ceil(totalCount / PROTOTYPES_PER_PAGE));
  if (page > totalPages) return totalPages;
  if (page > 1 && !hasItems) return Math.min(page - 1, totalPages);
  return null;
}
