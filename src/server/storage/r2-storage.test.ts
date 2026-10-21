import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { R2Storage } from "./r2-storage";

function storage(send: (command: unknown) => Promise<unknown>) {
  return new R2Storage(
    { send } as unknown as Pick<S3Client, "send">,
    "prospecta-assets",
  );
}

test("S3 writes are private, conditional and never use the original filename as a key", async () => {
  const bytes = Buffer.from("image");
  const s = storage(async (command) => {
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.Bucket, "prospecta-assets");
    assert.equal(command.input.Key, "users/uuid/assets/random.png");
    assert.equal(command.input.IfNoneMatch, "*");
    assert.equal(command.input.ContentType, "image/png");
    assert.equal(command.input.ContentLength, bytes.length);
    assert.equal(command.input.CacheControl, "private, no-store");
    assert.equal(command.input.ACL, undefined);
    assert.deepEqual(command.input.Body, bytes);
    return {};
  });
  await s.put("users/uuid/assets/random.png", bytes, "image/png");
});

test("S3 reads return actual bytes and cap streamed content even without Content-Length", async () => {
  let cancelled = false;
  const s = storage(async (command) => {
    assert.ok(command instanceof GetObjectCommand);
    return {
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]));
              controller.close();
            },
          }),
      },
    };
  });
  assert.deepEqual(await s.read("key", 3), Buffer.from([1, 2, 3]));
  await assert.rejects(s.read("key", 2), { code: "STORAGE_ERROR" });
  const streaming = storage(async () => ({
    Body: {
      transformToWebStream: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(4));
          },
          cancel() {
            cancelled = true;
          },
        }),
    },
  }));
  await assert.rejects(streaming.read("key", 3), { code: "STORAGE_ERROR" });
  assert.equal(cancelled, true);
});

test("S3 deletion targets the stored key only", async () => {
  const s = storage(async (command) => {
    assert.ok(command instanceof DeleteObjectCommand);
    assert.equal(command.input.Key, "stored-key");
    return {};
  });
  await s.remove("stored-key");
});

test("SDK exceptions are translated without exposing credentials or provider details", async () => {
  const s = storage(async () => {
    throw new Error("secret credential or internal error");
  });
  for (const operation of [
    () => s.put("key", Buffer.from("x"), "image/png"),
    () => s.read("key", 5),
    () => s.remove("key"),
  ]) {
    await assert.rejects(operation(), (error) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("secret"));
      assert.equal((error as { status?: number }).status, 502);
      return true;
    });
  }
});
