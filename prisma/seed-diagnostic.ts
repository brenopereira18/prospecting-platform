// Deliberately project only technical fields, never stack, SQL, args or arbitrary meta.
function redactor(connectionString?: string) {
  const secrets = new Set<string>();
  if (connectionString) {
    secrets.add(connectionString);
    try {
      const url = new URL(connectionString);
      for (const value of [url.username, url.password]) {
        if (!value) continue;
        secrets.add(value);
        try {
          secrets.add(decodeURIComponent(value));
        } catch {
          /* retain encoded form */
        }
      }
      for (const [key, value] of url.searchParams) {
        if (value && /pass|user|token|secret|key|credential|auth/i.test(key)) {
          secrets.add(value);
          secrets.add(encodeURIComponent(value));
        }
      }
    } catch {
      /* The entire supplied value is still redacted. */
    }
  }
  return (input: string) => {
    let output = input;
    for (const secret of [...secrets].sort((a, b) => b.length - a.length))
      output = output.split(secret).join("[REDACTED]");
    return output
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>]+/gi, "[REDACTED_URL]")
      .replace(
        /\bauthorization["']?\s*[:=]\s*["']?(?:(?:Bearer|Basic)\s+)?[^\s"'&,;]+/gi,
        "authorization=[REDACTED]",
      )
      .replace(
        /\b(password|passwd|pwd|sslpassword|pgpassword|user(?:name)?|(?:access[_-]?)?token|secret|api[_-]?key)["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi,
        "$1=[REDACTED]",
      )
      .replace(/\b(user|username)\s+(?:"[^"]*"|'[^']*')/gi, "$1 [REDACTED]")
      .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, "$1 [REDACTED]")
      .slice(0, 8000);
  };
}

export function seedErrorDiagnostic(error: unknown, connectionString?: string) {
  const redact = redactor(connectionString);
  const seen = new Set<object>();
  const details: {
    path: string;
    name?: string;
    code?: string;
    kind?: string;
    message?: string;
  }[] = [];
  function visit(value: unknown, path: string, depth: number) {
    if (depth > 6 || details.length >= 16) return;
    if (typeof value === "string") {
      details.push({ path, message: redact(value) });
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const row = value as Record<string, unknown>;
    const field = (key: string) =>
      typeof row[key] === "string" ? (row[key] as string) : undefined;
    const name = field("name");
    const code = field("code") ?? field("originalCode") ?? field("errorCode");
    const kind = field("kind");
    const message = field("message") ?? field("originalMessage");
    if (name || code || kind || message)
      details.push({
        path,
        ...(name ? { name: redact(name) } : {}),
        ...(code ? { code: redact(code) } : {}),
        ...(kind ? { kind: redact(kind) } : {}),
        ...(message ? { message: redact(message) } : {}),
      });
    // Known Prisma/adapter-pg nesting; do not serialize their entire metadata.
    for (const key of ["cause", "meta", "driverAdapterError"])
      if (row[key]) visit(row[key], `${path}.${key}`, depth + 1);
    if (Array.isArray(row.errors))
      row.errors
        .slice(0, 3)
        .forEach((item, i) => visit(item, `${path}.errors[${i}]`, depth + 1));
  }
  visit(error, "error", 0);
  const codes = new Set(details.map((row) => row.code));
  const kinds = new Set(details.map((row) => row.kind));
  const messages = details.map((row) => row.message ?? "").join("\n");
  const has = (...values: string[]) => values.some((code) => codes.has(code));
  let category = "UNKNOWN";
  if (
    has("P1000", "28P01", "28000") ||
    kinds.has("AuthenticationFailed") ||
    /password authentication failed|tenant or user not found/i.test(messages)
  )
    category = "AUTHENTICATION";
  else if (has("ENOTFOUND", "EAI_AGAIN") || /getaddrinfo/i.test(messages))
    category = "DNS";
  else if (
    has(
      "P1002",
      "P1008",
      "P2024",
      "ETIMEDOUT",
      "ESOCKETTIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
    ) ||
    kinds.has("SocketTimeout") ||
    /timed?\s*out|timeout|Connection terminated due to connection timeout/i.test(
      messages,
    )
  )
    category = "TIMEOUT";
  else if (
    has("P2021", "P2022", "42P01", "42703") ||
    kinds.has("TableDoesNotExist") ||
    kinds.has("ColumnNotFound")
  )
    category = "SCHEMA";
  else if (has("P1003", "3D000") || kinds.has("DatabaseDoesNotExist"))
    category = "DATABASE_NOT_FOUND";
  else if (has("P1010", "42501")) category = "PERMISSION";
  else if (
    has(
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ) ||
    /certificate|TLS|SSL/i.test(messages)
  )
    category = "TLS";
  else if (
    has("P1001", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH") ||
    kinds.has("DatabaseNotReachable")
  )
    category = "CONNECTION";
  return {
    category,
    details: details.length
      ? details
      : [
          {
            path: "error",
            name: "UnknownError",
            message: "Exceção sem campos técnicos disponíveis.",
          },
        ],
  };
}
