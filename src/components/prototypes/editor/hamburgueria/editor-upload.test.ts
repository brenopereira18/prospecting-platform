import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { EditorImageUploads, uploadPrototypeImage } from "./editor-upload";
import { TemporaryImageRegistry } from "./temporary-images";
import { createEditorDocument, editorDocumentReducer } from "./editor-document";
import { persistEditorOperation } from "./editor-save-operation";
import { persistablePrototypeDocumentSchema } from "../../schemas/persistable-document.schema";
import type { PrototypeDTO } from "@/src/server/prototypes/prototype.dto";

function fixture() {
  const prototypeId = randomUUID();
  const calls: File[] = [];
  const revoked: string[] = [];
  const registry = new TemporaryImageRegistry({
    createId: () => `local-${randomUUID()}`,
    createURL: () => `blob:http://localhost/${randomUUID()}`,
    revokeURL: (url) => revoked.push(url),
    dimensions: async () => ({ width: 4, height: 3 }),
  });
  const upload = async (_id: string, file: File) => {
    calls.push(file);
    return { id: randomUUID(), prototypeId, width: 4, height: 3 };
  };
  const cache = new EditorImageUploads(prototypeId, upload);
  const select = async (
    document = createEditorDocument(),
    name = "foto.png",
  ) => {
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
      name,
      { type: "image/png" },
    );
    const prepared = await registry.prepare(file);
    registry.confirm(prepared.assetId);
    return {
      file,
      prepared,
      document: editorDocumentReducer(document, {
        type: "image/upload",
        target: { kind: "hero" },
        assetId: prepared.assetId,
      }),
    };
  };
  return { prototypeId, calls, revoked, registry, cache, select };
}

test("selecting only prepares a local preview; replacing uploads just the last referenced file", async () => {
  const f = fixture();
  const first = await f.select();
  const second = await f.select(first.document, "ultima.png");
  f.registry.reconcile(second.document);
  assert.equal(f.calls.length, 0);
  assert.equal(f.registry.getFile(first.prepared.assetId), undefined);
  const saved = await f.cache.prepare(second.document, f.registry.getFile);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, "ultima.png");
  assert.equal(
    saved.document.content.hero.image.alt,
    second.document.content.hero.image.alt,
  );
  f.registry.clear();
});

test("removing a temporary image before saving uploads nothing", async () => {
  const f = fixture();
  const selected = await f.select();
  const document = editorDocumentReducer(selected.document, {
    type: "image/reset",
    target: { kind: "hero" },
  });
  f.registry.reconcile(document);
  await f.cache.prepare(document, f.registry.getFile);
  assert.equal(f.calls.length, 0);
  assert.equal(f.revoked.length, 1);
});

test("one temporary ID used by hidden sections and SEO uploads once and preserves image metadata", async () => {
  const f = fixture();
  const selected = await f.select();
  const document = selected.document;
  document.content.hero.image.focalPoint = { x: 20, y: 80 };
  document.seo.socialImage = structuredClone(document.content.hero.image);
  document.sections.hero = false;
  const before = structuredClone(document);
  const saved = await f.cache.prepare(document, f.registry.getFile);
  assert.equal(f.calls.length, 1);
  assert.equal(saved.document.content.hero.image.source, "upload");
  assert.deepEqual(
    saved.document.content.hero.image,
    saved.document.seo.socialImage,
  );
  assert.deepEqual(saved.document.content.hero.image.focalPoint, {
    x: 20,
    y: 80,
  });
  assert.deepEqual(document, before);
  assert.ok(
    persistablePrototypeDocumentSchema.safeParse(saved.document).success,
  );
  await f.cache.prepare(saved.document, f.registry.getFile);
  assert.equal(f.calls.length, 1);
  f.registry.clear();
});

test("partial upload failure preserves files and reuses the completed asset on retry", async () => {
  const f = fixture();
  const first = await f.select();
  const second = await f.select();
  const document = first.document;
  document.seo.socialImage = second.document.content.hero.image;
  const calls: string[] = [];
  let fail = true;
  const cache = new EditorImageUploads(f.prototypeId, async (_id, file) => {
    calls.push(file.name);
    if (calls.length === 2 && fail) throw new Error("R2 falhou");
    return {
      id: randomUUID(),
      prototypeId: f.prototypeId,
      width: 4,
      height: 3,
    };
  });
  const before = structuredClone(document);
  await assert.rejects(
    cache.prepare(document, f.registry.getFile),
    /R2 falhou/,
  );
  assert.deepEqual(document, before);
  assert.ok(f.registry.getFile(first.prepared.assetId));
  assert.ok(f.registry.getFile(second.prepared.assetId));
  fail = false;
  await cache.prepare(document, f.registry.getFile);
  assert.equal(calls.length, 3);
  f.registry.clear();
});

test("missing local files fail without persistence; resolved private sources survive resource release", async () => {
  const f = fixture();
  const selected = await f.select();
  await assert.rejects(
    f.cache.prepare(selected.document, () => undefined),
    /não está disponível/,
  );
  assert.equal(f.calls.length, 0);
  const saved = await f.cache.prepare(selected.document, f.registry.getFile);
  const current = editorDocumentReducer(selected.document, {
    type: "images/persisted",
    replacements: saved.replacements,
  });
  f.registry.reconcile(current);
  assert.equal(f.revoked.length, 1);
  const image = current.content.hero.image;
  assert.equal(image.source, "upload");
  if (image.source === "upload")
    assert.equal(
      f.cache.getResolvedUploads()[image.assetId].src,
      `/api/prototipos/${f.prototypeId}/assets/${image.assetId}`,
    );
});

test("late successful save changes only matching image IDs and preserves subsequent text/image edits", async () => {
  const f = fixture();
  const first = await f.select();
  const submitted = structuredClone(first.document);
  const saved = await f.cache.prepare(submitted, f.registry.getFile);
  let current = editorDocumentReducer(first.document, {
    type: "business",
    field: "name",
    value: "Digitado enquanto salvava",
  });
  current = editorDocumentReducer(current, {
    type: "images/persisted",
    replacements: saved.replacements,
  });
  assert.equal(current.business.name, "Digitado enquanto salvava");
  const second = await f.select(first.document);
  const newer = editorDocumentReducer(second.document, {
    type: "images/persisted",
    replacements: saved.replacements,
  });
  assert.deepEqual(
    newer.content.hero.image,
    second.document.content.hero.image,
  );
  f.registry.clear();
});

test("uploads use the existing authenticated endpoint and multipart field without client userId", async (t) => {
  const id = randomUUID(),
    assetId = randomUUID();
  let requested = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, `/api/prototipos/${id}/assets`);
      assert.equal(options.credentials, "same-origin");
      assert.deepEqual([...(options.body as FormData).keys()], ["file"]);
      requested = true;
      return Response.json(
        { asset: { id: assetId, prototypeId: id, width: 4, height: 3 } },
        { status: 201 },
      );
    },
  );
  const file = new File(["image"], "a.png", { type: "image/png" });
  assert.equal((await uploadPrototypeImage(id, file)).id, assetId);
  assert.equal(requested, true);
});

test("save retries PostgreSQL/conflict failures without repeating acknowledged uploads", async () => {
  const f = fixture();
  const selected = await f.select();
  let saved = false;
  let fail = true;
  const options = {
    id: f.prototypeId,
    revision: 0,
    name: "Proposta",
    document: selected.document,
    version: false,
    dirty: true,
    uploads: f.cache,
    getFile: f.registry.getFile,
    onProgress: () => {},
    saveDraft: async () =>
      fail
        ? {
            success: false as const,
            code: "CONFLICT" as const,
            error: "Revisão alterada",
          }
        : {
            success: true as const,
            data: { draftRevision: 1 } as PrototypeDTO,
          },
    createVersion: async () => {
      throw new Error("Must not create a version");
    },
    onSaved: () => {
      saved = true;
    },
  };
  const before = structuredClone(selected.document);
  assert.equal((await persistEditorOperation(options)).success, false);
  assert.equal(saved, false);
  assert.deepEqual(selected.document, before);
  assert.ok(f.registry.getFile(selected.prepared.assetId));
  fail = false;
  assert.equal((await persistEditorOperation(options)).success, true);
  assert.equal(f.calls.length, 1);
  assert.equal(saved, true);
  f.registry.clear();
});

test("creating a dirty version saves resolved references first and then uses the returned revision", async () => {
  const f = fixture();
  const selected = await f.select();
  const sequence: string[] = [];
  const result = await persistEditorOperation({
    id: f.prototypeId,
    revision: 2,
    name: "Proposta",
    document: selected.document,
    version: true,
    dirty: true,
    uploads: f.cache,
    getFile: f.registry.getFile,
    onProgress: () => {},
    saveDraft: async (input) => {
      sequence.push("save");
      assert.equal(input.expectedRevision, 2);
      assert.ok(
        persistablePrototypeDocumentSchema.safeParse(input.document).success,
      );
      return { success: true, data: { draftRevision: 3 } as PrototypeDTO };
    },
    onSaved: () => {
      sequence.push("saved");
    },
    createVersion: async (input) => {
      sequence.push("version");
      assert.equal(input.expectedRevision, 3);
      return {
        success: true,
        data: {
          id: randomUUID(),
          prototypeId: f.prototypeId,
          number: 1,
          createdAt: new Date().toISOString(),
          document: createEditorDocument(),
        },
      };
    },
  });
  assert.equal(result.success, true);
  assert.deepEqual(sequence, ["save", "saved", "version"]);
  assert.equal(f.calls.length, 1);
  f.registry.clear();
});

test("creating a clean version with permanent images performs no upload or redundant draft save", async () => {
  const f = fixture();
  const document = createEditorDocument();
  document.content.hero.image = {
    source: "upload",
    assetId: randomUUID(),
    alt: "Foto",
  };
  const result = await persistEditorOperation({
    id: f.prototypeId,
    revision: 4,
    name: "Proposta",
    document,
    version: true,
    dirty: false,
    uploads: f.cache,
    getFile: () => undefined,
    onProgress: () => {},
    saveDraft: async () => {
      throw new Error("Unnecessary save");
    },
    onSaved: () => {},
    createVersion: async (input) => {
      assert.equal(input.expectedRevision, 4);
      return {
        success: true,
        data: {
          id: randomUUID(),
          prototypeId: f.prototypeId,
          number: 2,
          createdAt: new Date().toISOString(),
          document,
        },
      };
    },
  });
  assert.equal(result.success, true);
  assert.equal(f.calls.length, 0);
});

test("a thrown persistence failure retains local files and acknowledged uploads for retry", async () => {
  const f = fixture();
  const selected = await f.select();
  let fail = true;
  let committed = false;
  const options = {
    id: f.prototypeId,
    revision: 0,
    name: "Proposta",
    document: selected.document,
    version: false,
    dirty: true,
    uploads: f.cache,
    getFile: f.registry.getFile,
    onProgress: () => {},
    onSaved: () => {
      committed = true;
    },
    saveDraft: async () => {
      if (fail) throw new Error("database unavailable");
      return {
        success: true as const,
        data: { draftRevision: 1 } as PrototypeDTO,
      };
    },
    createVersion: async () => {
      throw new Error("Must not create version");
    },
  };
  await assert.rejects(persistEditorOperation(options), /database unavailable/);
  assert.equal(committed, false);
  assert.ok(f.registry.getFile(selected.prepared.assetId));
  fail = false;
  await persistEditorOperation(options);
  assert.equal(f.calls.length, 1);
  assert.equal(committed, true);
  f.registry.clear();
});

test("version failure after a successful draft save keeps the committed references and revision", async () => {
  const f = fixture();
  const selected = await f.select();
  let saves = 0;
  let committed: ReturnType<typeof createEditorDocument> | undefined;
  const base = {
    id: f.prototypeId,
    revision: 0,
    name: "Proposta",
    document: selected.document,
    version: true,
    dirty: true,
    uploads: f.cache,
    getFile: f.registry.getFile,
    onProgress: () => {},
    saveDraft: async () => {
      saves++;
      return {
        success: true as const,
        data: { draftRevision: 1 } as PrototypeDTO,
      };
    },
    onSaved: (
      _saved: PrototypeDTO,
      submitted: ReturnType<typeof createEditorDocument>,
    ) => {
      committed = submitted;
    },
    createVersion: async () => ({
      success: false as const,
      code: "CONFLICT" as const,
      error: "Revisão alterada",
    }),
  };
  assert.equal((await persistEditorOperation(base)).success, false);
  assert.ok(committed);
  const retried = await persistEditorOperation({
    ...base,
    revision: 1,
    dirty: false,
    document: committed!,
    createVersion: async (input) => {
      assert.equal(input.expectedRevision, 1);
      return {
        success: true,
        data: {
          id: randomUUID(),
          prototypeId: f.prototypeId,
          number: 1,
          createdAt: new Date().toISOString(),
          document: committed!,
        },
      };
    },
  });
  assert.equal(retried.success, true);
  assert.equal(saves, 1);
  assert.equal(f.calls.length, 1);
  f.registry.clear();
});
