import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { seedErrorDiagnostic } from "./seed-diagnostic";

for (const [code, category] of [
  ["28P01", "AUTHENTICATION"],
  ["P1000", "AUTHENTICATION"],
  ["ENOTFOUND", "DNS"],
  ["EAI_AGAIN", "DNS"],
  ["ECONNREFUSED", "CONNECTION"],
  ["ECONNRESET", "CONNECTION"],
  ["ETIMEDOUT", "TIMEOUT"],
  ["P2024", "TIMEOUT"],
  ["42P01", "SCHEMA"],
  ["42703", "SCHEMA"],
  ["P2021", "SCHEMA"],
  ["42501", "PERMISSION"],
  ["3D000", "DATABASE_NOT_FOUND"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "TLS"],
] as const) {
  test(`classifica ${code} sem confundir a causa com o wrapper Prisma`, () => {
    const result = seedErrorDiagnostic(
      Object.assign(new Error("Database call failed"), {
        code: "P2010",
        meta: {
          driverAdapterError: {
            name: "DriverAdapterError",
            cause: {
              originalCode: code,
              originalMessage: "original provider message",
            },
          },
        },
      }),
    );
    assert.equal(result.category, category);
    assert.ok(
      result.details.some(
        (row) =>
          row.code === code && row.message === "original provider message",
      ),
    );
  });
}
test("expõe nome/mensagem/cadeia originais, sem stack ou metadata arbitrária", () => {
  const result = seedErrorDiagnostic(
    new TypeError("outer", {
      cause: Object.assign(new Error("inner"), {
        code: "ENOTFOUND",
        password: "never-print",
        meta: { query: "never-print", params: ["never-print"] },
      }),
    }),
  );
  assert.equal(result.details[0].name, "TypeError");
  assert.equal(result.details[1].path, "error.cause");
  assert.equal(result.details[1].message, "inner");
  assert.ok(!JSON.stringify(result).includes("never-print"));
  assert.ok(!JSON.stringify(result).includes("stack"));
});
test("redige URL, usuário, senha codificada/decodificada e parâmetros de autenticação", () => {
  const user = "postgres.project-secret";
  const password = "p@ss:/?# é";
  const token = "query-token-private";
  const url = `postgresql://${user}:${encodeURIComponent(password)}@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&token=${token}`;
  const error = new Error(
    `Connection ${url}; user "${user}"; decoded ${password}; encoded ${encodeURIComponent(password)}; query ${token}`,
  );
  const output = JSON.stringify(seedErrorDiagnostic(error, url));
  for (const secret of [
    url,
    user,
    password,
    encodeURIComponent(password),
    token,
  ])
    assert.ok(!output.includes(secret), secret);
  assert.ok(output.includes("REDACTED"));
});
test("redige credenciais em mensagens conninfo, JSON e Authorization sem contexto", () => {
  const output = JSON.stringify(
    seedErrorDiagnostic(
      new Error(
        `password='other secret' user="some-user" token=another-secret {"password":"json-secret"} Authorization: Bearer bearer-secret Basic basic-secret`,
      ),
    ),
  );
  for (const secret of [
    "other secret",
    "some-user",
    "another-secret",
    "json-secret",
    "bearer-secret",
    "basic-secret",
  ])
    assert.ok(!output.includes(secret), secret);
});
test("mensagens de autenticação e timeout sem código continuam úteis", () => {
  assert.equal(
    seedErrorDiagnostic(
      new Error('password authentication failed for user "private-user"'),
    ).category,
    "AUTHENTICATION",
  );
  assert.equal(
    seedErrorDiagnostic(
      new Error("Connection terminated due to connection timeout"),
    ).category,
    "TIMEOUT",
  );
});
test("limita cadeias cíclicas, AggregateError e exceções sem campos conhecidos", () => {
  const error: { cause?: unknown } = {};
  error.cause = error;
  assert.equal(seedErrorDiagnostic(error).category, "UNKNOWN");
  const result = seedErrorDiagnostic(
    new AggregateError(
      [Object.assign(new Error("dns"), { code: "ENOTFOUND" })],
      "aggregate",
    ),
  );
  assert.equal(result.category, "DNS");
  assert.equal(result.details[1].path, "error.errors[0]");
  assert.equal(seedErrorDiagnostic(null).category, "UNKNOWN");
});
test("CLI dry-run reporta falha técnica sem vazar credenciais ou executar apply", () => {
  // Local closed port, with fictitious credentials: no production connection.
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "prisma/seed.ts", "--target", "local", "--dry-run"],
    {
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql://diagnostic-user:diagnostic-password@127.0.0.1:1/postgres",
      },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('"category": "CONNECTION"'));
  assert.ok(result.stderr.includes('"code": "P1001"'));
  assert.ok(
    result.stderr.includes('"code"') || result.stderr.includes('"message"'),
  );
  assert.ok(result.stdout.includes("dry-run (READ ONLY)"));
  for (const secret of [
    "diagnostic-user",
    "diagnostic-password",
    "postgresql://",
  ]) {
    assert.ok(!result.stderr.includes(secret));
    assert.ok(!result.stdout.includes(secret));
  }
});
