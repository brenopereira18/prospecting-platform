import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { validateAssetImage, MAX_ASSET_IMAGE_BYTES } from "./asset-image";

test("decodes JPEG, PNG and WebP and reports real dimensions, MIME and a digest", async () => {
  for (const [format, type, ext] of [
    ["jpeg", "image/jpeg", "jpg"],
    ["png", "image/png", "png"],
    ["webp", "image/webp", "webp"],
  ] as const) {
    const bytes = await sharp({
      create: { width: 4, height: 3, channels: 3, background: "red" },
    })
      .toFormat(format)
      .toBuffer();
    const image = await validateAssetImage(
      new File([bytes], `foto.${ext}`, { type }),
    );
    assert.equal(image.width, 4);
    assert.equal(image.height, 3);
    assert.equal(image.mimeType, type);
    assert.equal(image.extension, ext);
    assert.deepEqual(image.bytes, bytes);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
  }
});

test("rejects empty, unsupported, mismatched and corrupt files including forged signatures", async () => {
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const files = [
    new File([], "foto.png", { type: "image/png" }),
    new File([png], "foto.svg", { type: "image/svg+xml" }),
    new File([png], "foto.jpg", { type: "image/jpeg" }),
    new File([png], "foto.txt", { type: "image/png" }),
    new File(
      [
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          Buffer.alloc(30),
        ]),
      ],
      "foto.png",
      { type: "image/png" },
    ),
    new File(["not an image"], "foto.webp", { type: "image/webp" }),
  ];
  for (const file of files)
    await assert.rejects(validateAssetImage(file), { code: "INVALID_IMAGE" });
});

test("enforces 5 MB from the actual bytes and sanitizes original paths", async () => {
  await assert.rejects(
    validateAssetImage(
      new File([new Uint8Array(MAX_ASSET_IMAGE_BYTES + 1)], "foto.jpg", {
        type: "image/jpeg",
      }),
    ),
    { code: "TOO_LARGE" },
  );
  const bytes = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const padded = Buffer.concat([
    bytes,
    Buffer.alloc(MAX_ASSET_IMAGE_BYTES - bytes.length),
  ]);
  const image = await validateAssetImage(
    new File([padded], "C:\\fakepath\\foto.png", { type: "image/png" }),
  );
  assert.equal(image.bytes.length, MAX_ASSET_IMAGE_BYTES);
  assert.equal(image.originalName, "foto.png");
});
