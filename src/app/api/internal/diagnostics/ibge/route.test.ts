import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route";

test("diagnóstico responde 404 fora do ambiente Preview sem iniciar sondagens", async () => {
  const originalEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";

  try {
    const response = await GET();
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnvironment;
  }
});
