import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import type {
  PrismaClient,
  PrototypeAsset,
} from "../../../generated/prisma/client";
import { PrototypeAssetService } from "./asset.service";
import { AssetError } from "./asset-error";
import { createAssetHandlers } from "./asset-http";
import { MAX_ASSET_IMAGE_BYTES } from "./asset-image";

type Where = {
  id?: string;
  userId?: string;
  prototypeId?: string;
  objectKey?: string;
  deletionRequestedAt?: null;
  deletedAt?: null;
  prototype?: { userId: string };
};

async function fixture() {
  const alice = randomUUID(),
    bob = randomUUID(),
    id = randomUUID(),
    other = randomUUID();
  const prototypes = new Map<
    string,
    { id: string; userId: string; draftDocument: unknown }
  >([
    [id, { id, userId: alice, draftDocument: {} }],
    [other, { id: other, userId: alice, draftDocument: {} }],
  ]);
  const rows = new Map<string, PrototypeAsset>();
  const versions: { prototypeId: string; document: unknown }[] = [];
  const objects = new Map<string, Buffer>();
  const removed: string[] = [];
  const logs: unknown[] = [];
  const flags = {
    put: false,
    read: false,
    remove: false,
    insert: false,
    recovery: false,
    commit: false,
    completeDelete: false,
  };
  let puts = 0;
  const matches = (row: PrototypeAsset, where: Where) =>
    Object.entries(where).every(([key, value]) =>
      key === "prototype"
        ? prototypes.get(row.prototypeId ?? "")?.userId ===
          (value as { userId: string }).userId
        : row[key as keyof PrototypeAsset] === value,
    );
  const db = {
    prototype: {
      findFirst: async ({ where }: { where: Where }) => {
        const row = prototypes.get(where.id ?? "");
        return row?.userId === where.userId ? row : null;
      },
    },
    prototypeAsset: {
      findFirst: async ({ where }: { where: Where }) => {
        if (flags.recovery) throw new Error("database unavailable");
        return [...rows.values()].find((row) => matches(row, where)) ?? null;
      },
      findMany: async ({ where }: { where: Where }) =>
        [...rows.values()].filter((row) => matches(row, where)),
      create: async ({ data }: { data: PrototypeAsset }) => {
        if (flags.insert) throw new Error("insert failed");
        const row = {
          ...data,
          createdAt: new Date(),
          deletionRequestedAt: null,
          deletedAt: null,
        };
        rows.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: Where;
        data: Partial<PrototypeAsset>;
      }) => {
        if (flags.completeDelete && data.deletedAt)
          throw new Error("delete completion failed");
        const row = { ...rows.get(where.id!)!, ...data };
        rows.set(row.id, row);
        return row;
      },
    },
    prototypeVersion: {
      findMany: async ({ where }: { where: Where }) =>
        versions.filter((version) => version.prototypeId === where.prototypeId),
    },
    $queryRaw: async () => [],
    $transaction: async <T>(operation: (tx: unknown) => Promise<T>) => {
      const snapshot = structuredClone(rows);
      let result: T;
      try {
        result = await operation(db);
      } catch (error) {
        rows.clear();
        snapshot.forEach((value, key) => rows.set(key, value));
        throw error;
      }
      if (flags.commit) {
        flags.commit = false;
        throw new Error("lost COMMIT acknowledgement");
      }
      return result;
    },
  };
  const storage = {
    put: async (key: string, bytes: Buffer) => {
      puts++;
      if (flags.put)
        throw new AssetError("STORAGE_ERROR", "R2 indisponível.", 502);
      objects.set(key, bytes);
    },
    read: async (key: string) => {
      if (flags.read)
        throw new AssetError("STORAGE_ERROR", "R2 indisponível.", 502);
      return objects.get(key)!;
    },
    remove: async (key: string) => {
      if (flags.remove)
        throw new AssetError("STORAGE_ERROR", "R2 indisponível.", 502);
      removed.push(key);
      objects.delete(key);
    },
  };
  const service = new PrototypeAssetService(
    db as unknown as PrismaClient,
    storage,
    (...args) => logs.push(args),
  );
  const bytes = await sharp({
    create: { width: 4, height: 3, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const file = () => new File([bytes], "foto.png", { type: "image/png" });
  const handlers = createAssetHandlers({
    service,
    getUser: async () => ({ id: alice }),
  });
  const context = (assetId?: string, prototypeId = id) => ({
    params: Promise.resolve({ id: prototypeId, assetId }),
  });
  const request = (
    method: string,
    body?: FormData,
    origin = "http://localhost:3000",
  ) =>
    new Request(`http://localhost:3000/api/prototipos/${id}/assets`, {
      method,
      body,
      headers: { origin },
    });
  const form = () => {
    const body = new FormData();
    body.set("file", file());
    return body;
  };
  return {
    alice,
    bob,
    id,
    other,
    prototypes,
    rows,
    versions,
    objects,
    removed,
    flags,
    service,
    file,
    handlers,
    context,
    request,
    form,
    bytes,
    logs,
    putCount: () => puts,
  };
}

test("registers only after upload, uses a unique object key and returns a private URL without storage credentials", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  assert.equal(f.rows.size, 1);
  assert.equal(f.objects.size, 1);
  const row = f.rows.get(asset.id)!;
  assert.equal(row.userId, f.alice);
  assert.equal(row.prototypeId, f.id);
  assert.equal(
    row.objectKey,
    `users/${f.alice}/prototypes/${f.id}/assets/${asset.id}.png`,
  );
  assert.ok(!row.objectKey.includes("foto"));
  assert.ok(!("objectKey" in asset));
  assert.equal(asset.url, `/api/prototipos/${f.id}/assets/${asset.id}`);
  const second = await f.service.upload(f.id, f.file(), f.alice);
  assert.notEqual(asset.id, second.id);
});

test("foreign or missing prototypes cannot upload or list assets", async () => {
  const f = await fixture();
  for (const prototypeId of [f.id, randomUUID()]) {
    await assert.rejects(f.service.upload(prototypeId, f.file(), f.bob), {
      code: "NOT_FOUND",
    });
    await assert.rejects(f.service.list(prototypeId, f.bob), {
      code: "NOT_FOUND",
    });
  }
  assert.equal(f.putCount(), 0);
});

test("asset lookup, read and deletion enforce both user and prototype association", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  for (const [prototypeId, userId] of [
    [f.id, f.bob],
    [f.other, f.alice],
  ]) {
    await assert.rejects(f.service.findById(prototypeId, asset.id, userId), {
      code: "NOT_FOUND",
    });
    await assert.rejects(f.service.read(prototypeId, asset.id, userId), {
      code: "NOT_FOUND",
    });
    await assert.rejects(
      f.service.deleteUnused(prototypeId, asset.id, userId),
      { code: "NOT_FOUND" },
    );
  }
  assert.equal(f.removed.length, 0);
  assert.equal((await f.service.list(f.id, f.alice)).length, 1);
});

test("R2 upload failure never creates a database registration", async () => {
  const f = await fixture();
  f.flags.put = true;
  await assert.rejects(f.service.upload(f.id, f.file(), f.alice), {
    code: "STORAGE_ERROR",
  });
  assert.equal(f.rows.size, 0);
  assert.equal(f.logs.length, 1);
});

test("confirmed database rollback compensates the upload without retaining an asset", async () => {
  const f = await fixture();
  f.flags.insert = true;
  await assert.rejects(
    f.service.upload(f.id, f.file(), f.alice),
    /insert failed/,
  );
  assert.equal(f.rows.size, 0);
  assert.equal(f.objects.size, 0);
  assert.equal(f.removed.length, 1);
});

test("lost commit acknowledgement recovers the registered asset instead of deleting it", async () => {
  const f = await fixture();
  f.flags.commit = true;
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  assert.ok(f.rows.has(asset.id));
  assert.equal(f.removed.length, 0);
  assert.equal(f.objects.size, 1);
});

test("uncertain PostgreSQL outcome preserves the object for reconciliation", async () => {
  const f = await fixture();
  f.flags.insert = true;
  f.flags.recovery = true;
  await assert.rejects(f.service.upload(f.id, f.file(), f.alice));
  assert.equal(f.objects.size, 1);
  assert.equal(f.removed.length, 0);
  assert.equal(f.logs.length, 1);
});

test("failed R2 compensation is reported without hiding the registration failure", async () => {
  const f = await fixture();
  f.flags.insert = true;
  f.flags.remove = true;
  await assert.rejects(
    f.service.upload(f.id, f.file(), f.alice),
    /insert failed/,
  );
  assert.equal(f.objects.size, 1);
  assert.equal(f.logs.length, 1);
});

test("read verifies size and digest and reports R2 failures", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  assert.deepEqual(
    (await f.service.read(f.id, asset.id, f.alice)).bytes,
    f.bytes,
  );
  f.objects.set(f.rows.get(asset.id)!.objectKey, Buffer.alloc(f.bytes.length));
  await assert.rejects(f.service.read(f.id, asset.id, f.alice), {
    code: "STORAGE_ERROR",
  });
  f.flags.read = true;
  await assert.rejects(f.service.read(f.id, asset.id, f.alice), {
    code: "STORAGE_ERROR",
  });
});

test("draft, hidden sections and immutable version references prevent object deletion", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  f.prototypes.get(f.id)!.draftDocument = {
    sections: { hero: false },
    content: { hero: { image: { source: "upload", assetId: asset.id } } },
  };
  await assert.rejects(f.service.deleteUnused(f.id, asset.id, f.alice), {
    code: "IN_USE",
  });
  f.prototypes.get(f.id)!.draftDocument = {};
  f.versions.push({
    prototypeId: f.id,
    document: { seo: { socialImage: { source: "upload", assetId: asset.id } } },
  });
  const original = structuredClone(f.versions);
  await assert.rejects(f.service.deleteUnused(f.id, asset.id, f.alice), {
    code: "IN_USE",
  });
  assert.deepEqual(f.versions, original);
  assert.equal(f.objects.size, 1);
  assert.equal(f.rows.get(asset.id)!.deletionRequestedAt, null);
});

test("deletion uses a durable tombstone and retries after R2 failure", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  f.flags.remove = true;
  await assert.rejects(f.service.deleteUnused(f.id, asset.id, f.alice), {
    code: "STORAGE_ERROR",
  });
  assert.ok(f.rows.get(asset.id)!.deletionRequestedAt);
  assert.equal(f.objects.size, 1);
  assert.equal((await f.service.list(f.id, f.alice)).length, 0);
  await assert.rejects(f.service.read(f.id, asset.id, f.alice), {
    code: "NOT_FOUND",
  });
  f.flags.remove = false;
  await f.service.deleteUnused(f.id, asset.id, f.alice);
  assert.equal(f.objects.size, 0);
  assert.ok(f.rows.get(asset.id)!.deletedAt);
  await f.service.deleteUnused(f.id, asset.id, f.alice);
  assert.equal(f.removed.length, 1);
});

test("database failure after R2 deletion remains retryable with retained metadata", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  f.flags.completeDelete = true;
  await assert.rejects(
    f.service.deleteUnused(f.id, asset.id, f.alice),
    /completion/,
  );
  assert.equal(f.objects.size, 0);
  assert.ok(f.rows.get(asset.id)!.deletionRequestedAt);
  f.flags.completeDelete = false;
  await f.service.deleteUnused(f.id, asset.id, f.alice);
  assert.ok(f.rows.get(asset.id)!.deletedAt);
});

test("all HTTP operations require the session and never trust client userId", async () => {
  const f = await fixture();
  const handlers = createAssetHandlers({
    service: f.service,
    getUser: async () => null,
  });
  for (const operation of [
    handlers.upload,
    handlers.list,
    handlers.read,
    handlers.remove,
  ])
    assert.equal(
      (await operation(f.request("POST", f.form()), f.context(randomUUID())))
        .status,
      401,
    );
  const form = f.form();
  form.set("userId", f.bob);
  assert.equal(
    (await f.handlers.upload(f.request("POST", form), f.context())).status,
    400,
  );
  assert.equal(f.rows.size, 0);
});

test("upload and delete reject cross-origin requests", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.handlers.upload(
        f.request("POST", f.form(), "https://attacker.example"),
        f.context(),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.handlers.remove(
        f.request("DELETE", undefined, "https://attacker.example"),
        f.context(randomUUID()),
      )
    ).status,
    403,
  );
  assert.equal(f.putCount(), 0);
});

test("upload checks ownership before consuming a file or contacting R2", async () => {
  const f = await fixture();
  const handlers = createAssetHandlers({
    service: f.service,
    getUser: async () => ({ id: f.bob }),
  });
  const req = f.request("POST", f.form());
  assert.equal((await handlers.upload(req, f.context())).status, 404);
  assert.equal(req.bodyUsed, false);
  assert.equal(f.putCount(), 0);
});

test("HTTP upload, listing and private read preserve bytes and disable shared caching", async () => {
  const f = await fixture();
  const response = await f.handlers.upload(
    f.request("POST", f.form()),
    f.context(),
  );
  assert.equal(response.status, 201);
  const { asset } = await response.json();
  const read = await f.handlers.read(f.request("GET"), f.context(asset.id));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("content-type"), "image/png");
  assert.match(read.headers.get("cache-control")!, /private, no-store/);
  assert.equal(read.headers.get("vary"), "Cookie");
  assert.equal(read.headers.get("x-content-type-options"), "nosniff");
  assert.equal(read.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), f.bytes);
  const list = await f.handlers.list(f.request("GET"), f.context());
  assert.equal((await list.json()).assets.length, 1);
  const foreign = createAssetHandlers({
    service: f.service,
    getUser: async () => ({ id: f.bob }),
  });
  assert.equal(
    (await foreign.read(f.request("GET"), f.context(asset.id))).status,
    404,
  );
});

test("HTTP rejects invalid MIME, oversized files, duplicate fields and malformed requests", async () => {
  const f = await fixture();
  for (const [file, status] of [
    [new File(["fake"], "a.png", { type: "image/png" }), 422],
    [
      new File([new Uint8Array(MAX_ASSET_IMAGE_BYTES + 1)], "a.png", {
        type: "image/png",
      }),
      413,
    ],
  ] as const) {
    const form = new FormData();
    form.set("file", file);
    assert.equal(
      (await f.handlers.upload(f.request("POST", form), f.context())).status,
      status,
    );
  }
  const duplicate = f.form();
  duplicate.append("file", f.file());
  assert.equal(
    (await f.handlers.upload(f.request("POST", duplicate), f.context())).status,
    400,
  );
  assert.equal(
    (await f.handlers.upload(f.request("POST"), f.context())).status,
    400,
  );
  const oversized = f.request("POST", f.form());
  oversized.headers.set(
    "content-length",
    String(MAX_ASSET_IMAGE_BYTES + 65537),
  );
  assert.equal((await f.handlers.upload(oversized, f.context())).status, 413);
  const streamed = new Request(
    `http://localhost:3000/api/prototipos/${f.id}/assets`,
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "multipart/form-data; boundary=test",
      },
      body: new Uint8Array(MAX_ASSET_IMAGE_BYTES + 65537),
    },
  );
  assert.equal((await f.handlers.upload(streamed, f.context())).status, 413);
  assert.equal(f.putCount(), 0);
});

test("HTTP storage/database errors are understandable and exclude internal details", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = await fixture();
  f.flags.put = true;
  assert.equal(
    (await f.handlers.upload(f.request("POST", f.form()), f.context())).status,
    502,
  );
  f.flags.put = false;
  f.flags.insert = true;
  const response = await f.handlers.upload(
    f.request("POST", f.form()),
    f.context(),
  );
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes("insert failed"));
});

test("HTTP deletion is explicit, idempotent and does not mutate prototype documents", async () => {
  const f = await fixture();
  const asset = await f.service.upload(f.id, f.file(), f.alice);
  const before = structuredClone(f.prototypes);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await f.handlers.remove(f.request("DELETE"), f.context(asset.id)))
        .status,
      204,
    );
  assert.deepEqual(f.prototypes, before);
  assert.equal(f.rows.size, 1);
});
