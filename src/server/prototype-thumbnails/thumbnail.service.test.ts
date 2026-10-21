import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import type {
  PrismaClient,
  PrototypeThumbnail,
} from "../../../generated/prisma/client";
import { PrototypeThumbnailService, ThumbnailError } from "./thumbnail.service";
import { createThumbnailHandlers } from "./thumbnail-http";
import { encodeThumbnail, validateThumbnail } from "./thumbnail-image";
import { thumbnailOrigin } from "./capture-thumbnail";

const image = sharp({
  create: { width: 1440, height: 810, channels: 3, background: "#f5b521" },
})
  .png()
  .toBuffer()
  .then(encodeThumbnail);
type Where = {
  versionId?: string;
  attemptId?: string;
  status?: string | { in: string[] };
  leaseExpiresAt?: { lt?: Date; gt?: Date };
  OR?: Where[];
};
function matches(row: PrototypeThumbnail, where: Where): boolean {
  return (
    (!where.versionId || row.versionId === where.versionId) &&
    (!where.attemptId || row.attemptId === where.attemptId) &&
    (!where.status ||
      (typeof where.status === "string"
        ? row.status === where.status
        : where.status.in.includes(row.status))) &&
    (!where.leaseExpiresAt?.lt ||
      row.leaseExpiresAt < where.leaseExpiresAt.lt) &&
    (!where.leaseExpiresAt?.gt ||
      row.leaseExpiresAt > where.leaseExpiresAt.gt) &&
    (!where.OR || where.OR.some((condition) => matches(row, condition)))
  );
}

async function fixture() {
  const bytes = await image;
  const prototypeId = randomUUID(),
    versionId = randomUUID(),
    userId = randomUUID();
  const rows = new Map<string, PrototypeThumbnail>();
  const objects = new Map<string, Buffer>();
  let captures = 0,
    puts = 0,
    removals = 0;
  let capture: () => Promise<Buffer> = async () => bytes;
  let failPut = false,
    failCommit = false;
  const db = {
    prototypeVersion: {
      findFirst: async ({
        where,
      }: {
        where: {
          id: string;
          prototypeId: string;
          prototype: { userId: string };
        };
      }) =>
        where.id === versionId &&
        where.prototypeId === prototypeId &&
        where.prototype.userId === userId
          ? { id: versionId }
          : null,
    },
    prototypeThumbnail: {
      findUnique: async ({ where }: { where: { versionId: string } }) =>
        structuredClone(rows.get(where.versionId) ?? null),
      upsert: async ({
        where,
        create,
      }: {
        where: { versionId: string };
        create: Omit<PrototypeThumbnail, "createdAt" | "generatedAt">;
      }) => {
        if (!rows.has(where.versionId))
          rows.set(where.versionId, {
            ...create,
            generatedAt: null,
            createdAt: new Date(),
          });
        return structuredClone(rows.get(where.versionId));
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<PrototypeThumbnail>;
      }) => {
        if (data.status === "ready" && failCommit) {
          failCommit = false;
          throw new Error("DB commit unavailable");
        }
        const row = [...rows.values()].find((row) => matches(row, where));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  const service = new PrototypeThumbnailService(
    db as unknown as PrismaClient,
    {
      read: async (key) => {
        const result = objects.get(key);
        if (!result) throw new Error("Missing object");
        return result;
      },
      put: async (key, data, type) => {
        assert.equal(type, "image/webp");
        puts++;
        if (failPut) throw new Error("R2 unavailable");
        if (objects.has(key)) throw new Error("Precondition failed");
        objects.set(key, data);
      },
      remove: async () => {
        removals++;
      },
    },
    async (pid, vid, token) => {
      assert.equal(pid, prototypeId);
      assert.equal(vid, versionId);
      assert.equal(token, "test-session");
      captures++;
      return capture();
    },
  );
  return {
    service,
    prototypeId,
    versionId,
    userId,
    rows,
    objects,
    bytes,
    generate: () =>
      service.generate(prototypeId, versionId, userId, "test-session"),
    read: () => service.read(prototypeId, versionId, userId),
    counts: () => ({ captures, puts, removals }),
    captureWith: (callback: () => Promise<Buffer>) => {
      capture = callback;
    },
    failStorage: (value: boolean) => {
      failPut = value;
    },
    failNextCommit: () => {
      failCommit = true;
    },
  };
}

test("generates a standardized WebP once per saved version and reuses the private artifact", async () => {
  const f = await fixture();
  const first = await f.generate();
  assert.equal(first.reused, false);
  assert.equal((await f.generate()).reused, true);
  assert.deepEqual(f.counts(), { captures: 1, puts: 1, removals: 0 });
  assert.deepEqual(await f.read(), f.bytes);
  const row = f.rows.get(f.versionId)!;
  assert.ok(row.objectKey.startsWith("thumbnails/v1/users/"));
  assert.ok(row.objectKey.endsWith(`/versions/${f.versionId}.webp`));
  assert.equal(row.status, "ready");
  assert.ok(row.generatedAt instanceof Date);
});

test("a durable per-version lease rejects concurrent captures and permits retry after expiry", async () => {
  const f = await fixture();
  let release!: () => void, started!: () => void;
  const capturing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.captureWith(async () => {
    started();
    await gate;
    return f.bytes;
  });
  const pending = f.generate();
  await capturing;
  await assert.rejects(f.generate(), { code: "BUSY" });
  release();
  await pending;
  assert.equal(f.counts().captures, 1);
  f.objects.clear();
  Object.assign(f.rows.get(f.versionId)!, {
    status: "generating",
    leaseExpiresAt: new Date(0),
  });
  await f.generate();
  assert.equal(f.counts().captures, 2);
});

test("capture and R2 failures leave a retryable derived record without deleting original objects", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = await fixture();
  f.captureWith(async () => {
    throw new Error("Browser unavailable");
  });
  await assert.rejects(f.generate(), { code: "GENERATION_FAILED" });
  assert.equal(f.rows.get(f.versionId)?.status, "failed");
  assert.equal(f.objects.size, 0);
  f.captureWith(async () => f.bytes);
  f.failStorage(true);
  await assert.rejects(f.generate(), { code: "GENERATION_FAILED" });
  f.failStorage(false);
  await f.generate();
  assert.equal(f.rows.get(f.versionId)?.status, "ready");
  assert.equal(f.counts().removals, 0);
});

test("an upload acknowledged before a database failure is recovered without another capture or upload", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = await fixture();
  f.failNextCommit();
  await assert.rejects(f.generate(), { code: "GENERATION_FAILED" });
  assert.equal(f.objects.size, 1);
  assert.equal((await f.generate()).reused, true);
  assert.deepEqual(f.counts(), { captures: 1, puts: 1, removals: 0 });
});

test("private reads and generation reject foreign users, other prototypes and missing versions before storage", async () => {
  const f = await fixture();
  for (const [pid, vid, uid] of [
    [f.prototypeId, f.versionId, randomUUID()],
    [randomUUID(), f.versionId, f.userId],
    [f.prototypeId, randomUUID(), f.userId],
  ]) {
    await assert.rejects(f.service.read(pid, vid, uid), { code: "NOT_FOUND" });
    await assert.rejects(f.service.generate(pid, vid, uid, "test-session"), {
      code: "NOT_FOUND",
    });
  }
  assert.deepEqual(f.counts(), { captures: 0, puts: 0, removals: 0 });
});

test("legacy versions have no implicit generation; missing objects can be generated again explicitly", async () => {
  const f = await fixture();
  await assert.rejects(f.read(), { code: "NOT_FOUND" });
  assert.equal(f.rows.size, 0);
  assert.equal(f.counts().captures, 0);
  await f.generate();
  f.objects.clear();
  await assert.rejects(f.read());
  await f.generate();
  assert.equal(f.counts().captures, 2);
});

test("malformed captures and stale attempts cannot publish an invalid or superseded artifact", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = await fixture();
  f.captureWith(async () => Buffer.from("not an image"));
  await assert.rejects(f.generate(), { code: "GENERATION_FAILED" });
  f.captureWith(async () => {
    f.rows.get(f.versionId)!.attemptId = randomUUID();
    return f.bytes;
  });
  await assert.rejects(f.generate(), { code: "BUSY" });
  assert.equal(f.counts().puts, 0);
});

test("HTTP thumbnails authenticate both methods, protect POST origin and keep image bytes private", async () => {
  const f = await fixture();
  let user: { id: string } | null = null;
  const handlers = createThumbnailHandlers({
    getUser: async () => user,
    getSessionToken: async () => "test-session",
    service: f.service,
  });
  const url = `http://localhost/api/prototipos/${f.prototypeId}/versoes/${f.versionId}/miniatura`;
  const context = {
    params: Promise.resolve({ id: f.prototypeId, versionId: f.versionId }),
  };
  assert.equal((await handlers.GET(new Request(url), context)).status, 401);
  assert.equal(
    (await handlers.POST(new Request(url, { method: "POST" }), context)).status,
    401,
  );
  user = { id: f.userId };
  assert.equal(
    (
      await handlers.POST(
        new Request(url, {
          method: "POST",
          headers: { Origin: "https://other.invalid" },
        }),
        context,
      )
    ).status,
    403,
  );
  assert.equal((await handlers.GET(new Request(url), context)).status, 404);
  const post = await handlers.POST(
    new Request(url, {
      method: "POST",
      headers: { Origin: "http://localhost" },
    }),
    context,
  );
  assert.equal(post.status, 200);
  const response = await handlers.GET(new Request(url), context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.ok(
    response.headers.get("cache-control")?.includes("private, no-store"),
  );
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.bytes);
  user = { id: randomUUID() };
  assert.equal((await handlers.GET(new Request(url), context)).status, 404);
});

test("HTTP errors are actionable and never leak storage, browser or credential details", async () => {
  const handlers = createThumbnailHandlers({
    getUser: async () => ({ id: "server-session-user" }),
    getSessionToken: async () => "server-token",
    service: {
      read: async () => {
        throw new Error("R2 secret key");
      },
      generate: async () => {
        throw new ThumbnailError("BUSY", "Aguarde e tente novamente.", 409);
      },
    },
  });
  const context = {
    params: Promise.resolve({ id: randomUUID(), versionId: randomUUID() }),
  };
  const read = await handlers.GET(
    new Request("http://localhost/image"),
    context,
  );
  assert.equal(read.status, 502);
  assert.ok(!(await read.text()).includes("secret"));
  const busy = await handlers.POST(
    new Request("http://localhost/image", {
      method: "POST",
      headers: { Origin: "http://localhost" },
    }),
    context,
  );
  assert.equal(busy.status, 409);
});

test("POST checks the browser Host when Next normalizes its internal hostname, without accepting foreign origins", async () => {
  let captures = 0;
  const handlers = createThumbnailHandlers({
    getUser: async () => ({ id: "session-user" }),
    getSessionToken: async () => "session-token",
    service: {
      read: async () => Buffer.alloc(0),
      generate: async () => {
        captures++;
        return { url: "/api/thumbnail", reused: false };
      },
    },
  });
  const context = {
    params: Promise.resolve({ id: randomUUID(), versionId: randomUUID() }),
  };
  const post = (origin: string) =>
    handlers.POST(
      new Request("http://localhost:3101/api/thumbnail", {
        method: "POST",
        headers: {
          Host: "127.0.0.1:3101",
          Origin: origin,
          "Sec-Fetch-Site": "same-origin",
        },
      }),
      context,
    );
  assert.equal((await post("http://127.0.0.1:3101")).status, 200);
  assert.equal((await post("https://foreign.example")).status, 403);
  assert.equal(captures, 1);
});

test("capture configuration never accepts arbitrary browser destinations and encoding stays 960×540", async () => {
  assert.equal(
    thumbnailOrigin("http://127.0.0.1:3101"),
    "http://127.0.0.1:3101",
  );
  assert.equal(
    thumbnailOrigin("https://prospecta.example"),
    "https://prospecta.example",
  );
  for (const url of [
    "http://untrusted.example",
    "https://user:password@prospecta.example",
    "https://prospecta.example/path",
    "file:///etc/passwd",
  ])
    assert.throws(() => thumbnailOrigin(url));
  await validateThumbnail(await image);
  await assert.rejects(validateThumbnail(Buffer.from("loading placeholder")));
});
