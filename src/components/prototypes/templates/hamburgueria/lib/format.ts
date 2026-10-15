export function getWhatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^\d{10,15}$/.test(digits)
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : null;
}

export function formatPriceCents(
  value: number,
  locale: string,
  currency: string,
) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    value / 100,
  );
}

export function formatPriceParts(
  value: number,
  locale: string,
  currency: string,
) {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).formatToParts(value / 100);
  const fractionStart = parts.findIndex((part) => part.type === "decimal");
  const fractionEnd = parts.findIndex((part) => part.type === "fraction");
  if (fractionStart < 0 || fractionEnd < 0) {
    return {
      main: parts.map((part) => part.value).join(""),
      fraction: "",
      suffix: "",
    };
  }
  return {
    main: parts
      .slice(0, fractionStart)
      .map((part) => part.value)
      .join(""),
    fraction: parts
      .slice(fractionStart, fractionEnd + 1)
      .map((part) => part.value)
      .join(""),
    suffix: parts
      .slice(fractionEnd + 1)
      .map((part) => part.value)
      .join(""),
  };
}

/** Plain-text interpolation only; callers render the result as escaped React text. */
export function formatCopy(
  text: string,
  values: Record<string, string | number>,
) {
  return text.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    String(values[key] ?? placeholder),
  );
}
