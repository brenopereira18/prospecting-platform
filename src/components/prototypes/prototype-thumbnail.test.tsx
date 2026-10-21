import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PrototypeThumbnail,
  requestPrototypeThumbnail,
} from "./prototype-thumbnail";

const version = {
  id: "v3",
  prototypeId: "p1",
  number: 3,
  createdAt: "2026-10-22T12:00:00Z",
};

test("saved thumbnails use authenticated direct image reads and link to their exact snapshot", () => {
  const html = renderToStaticMarkup(
    <PrototypeThumbnail
      prototypeId="p1"
      version={{ ...version, thumbnailReady: true }}
    />,
  );
  assert.ok(html.includes('href="/prototipos/p1/versoes/v3"'));
  assert.ok(
    html.includes('src="/api/prototipos/p1/versoes/v3/miniatura?attempt=0"'),
  );
  assert.ok(!html.includes("/_next/image"));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes("aspect-[2.5/1]"));
  assert.ok(html.includes("motion-safe:transition-transform"));
  assert.ok(html.includes("group-focus-within/thumbnail"));
  assert.ok(html.includes("Visualizar protótipo"));
});

test("missing and legacy thumbnails offer explicit generation with a reserved ratio and no automatic requests", (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({}),
  );
  const html = renderToStaticMarkup(
    <PrototypeThumbnail prototypeId="p1" version={version} />,
  );
  assert.ok(html.includes("Gerar miniatura"));
  assert.ok(html.includes("aspect-[2.5/1]"));
  assert.ok(!html.includes("<img"));
  assert.equal(fetch.mock.callCount(), 0);
  const empty = renderToStaticMarkup(
    <PrototypeThumbnail prototypeId="p1" version={null} />,
  );
  assert.ok(empty.includes("Crie uma versão"));
  assert.ok(!empty.includes("<button"));
});

test("generation is an explicit POST and safe errors permit retry without touching the document", async () => {
  let calls = 0;
  await requestPrototypeThumbnail("/api/thumbnail", async (url, options) => {
    calls++;
    assert.equal(url, "/api/thumbnail");
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.body, undefined);
    return Response.json({ url: "/api/thumbnail", reused: true });
  });
  assert.equal(calls, 1);
  await assert.rejects(
    requestPrototypeThumbnail("/api/thumbnail", async () =>
      Response.json({ error: "Aguarde e tente novamente." }, { status: 409 }),
    ),
    /Aguarde/,
  );
  await assert.rejects(
    requestPrototypeThumbnail(
      "/api/thumbnail",
      async () => new Response("<html>debug</html>", { status: 500 }),
    ),
    /Não foi possível gerar/,
  );
  await assert.rejects(
    requestPrototypeThumbnail("/api/thumbnail", async () => {
      throw new Error("Network internals");
    }),
    /Não foi possível conectar/,
  );
});
