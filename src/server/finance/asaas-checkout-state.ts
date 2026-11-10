/** Presentation only: an elapsed local deadline is not a payment confirmation. */
export function checkoutState(
  status: string | undefined,
  expiresAt?: string | Date,
  now = Date.now(),
) {
  const elapsed = !!expiresAt && new Date(expiresAt).getTime() <= now;
  const deadlineElapsed =
    elapsed && (status === "PREPARED" || status === "ACTIVE");
  return {
    deadlineElapsed,
    canOpen: !deadlineElapsed && (status === "PREPARED" || status === "ACTIVE"),
    canPrepare:
      !status ||
      ["CANCELED", "EXPIRED", "REJECTED"].includes(status) ||
      deadlineElapsed,
    canCancel:
      !deadlineElapsed && (status === "PREPARED" || status === "ACTIVE"),
    message:
      status === "PAID"
        ? "Este checkout já foi pago. Não é necessário realizar outro pagamento."
        : status === "EXPIRED" || deadlineElapsed
          ? "O prazo deste checkout terminou. Solicite um novo link ao prestador."
          : status === "CANCELED"
            ? "Este checkout foi cancelado. Solicite um novo link ao prestador."
            : status === "REJECTED"
              ? "O Asaas recusou a criação deste checkout. Consulte o prestador."
              : "Este checkout está em processamento ou precisa de conciliação. Consulte o prestador antes de tentar novamente.",
  };
}
