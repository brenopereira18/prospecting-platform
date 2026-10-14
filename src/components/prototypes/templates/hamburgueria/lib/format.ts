export function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getWhatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^\d{12,13}$/.test(digits)
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : null;
}
