import assert from "node:assert/strict";
import { test } from "node:test";
import { imageReferenceSchema } from "../../../schemas/prototype-base.schema";
import {
  dragImageFraming,
  getImageFraming,
  getImageFramingGeometry,
  getImageFramingStyle,
} from "./image-framing";

test("old images retain their focal point and start at 100% without changing legacy CSS", () => {
  const image = { source: "template", key: "hero", alt: "Foto" } as const;
  assert.deepEqual(getImageFraming(image), {
    zoom: 1,
    positionX: 50,
    positionY: 50,
  });
  assert.equal(getImageFramingStyle(image), undefined);
  assert.deepEqual(
    getImageFraming({ ...image, focalPoint: { x: 20, y: 80 } }),
    { zoom: 1, positionX: 20, positionY: 80 },
  );
  assert.deepEqual(
    getImageFramingStyle({ ...image, focalPoint: { x: 20, y: 80 } }),
    { objectPosition: "20% 80%" },
  );
  assert.deepEqual(imageReferenceSchema.parse(image), image);
});

test("framing accepts finite zoom 100–300% and bounded positions for both image sources", () => {
  for (const source of [
    { source: "template", key: "hero" },
    { source: "upload", assetId: "local-photo" },
  ]) {
    const image = {
      ...source,
      alt: "Foto",
      framing: { zoom: 2, positionX: 0, positionY: 100 },
    };
    assert.ok(imageReferenceSchema.safeParse(image).success);
    for (const [key, invalid] of [
      ["zoom", 0.99],
      ["zoom", 3.01],
      ["zoom", NaN],
      ["zoom", Infinity],
      ["positionX", -1],
      ["positionY", 101],
      ["positionY", -Infinity],
    ] as const)
      assert.equal(
        imageReferenceSchema.safeParse({
          ...image,
          framing: { ...image.framing, [key]: invalid },
        }).success,
        false,
      );
  }
});

test("cover, zoom and every position leave no empty edges across responsive aspect ratios", () => {
  for (const source of [
    { width: 1600, height: 900 },
    { width: 700, height: 1600 },
  ])
    for (const frame of [
      { width: 390, height: 440 },
      { width: 1440, height: 700 },
      { width: 112, height: 112 },
      { width: 500, height: 230 },
    ])
      for (const zoom of [1, 1.75, 3])
        for (const positionX of [0, 50, 100])
          for (const positionY of [0, 50, 100]) {
            const geometry = getImageFramingGeometry(source, frame, {
              zoom,
              positionX,
              positionY,
            });
            assert.ok(geometry.left <= 0.00001 && geometry.top <= 0.00001);
            assert.ok(geometry.left + geometry.width >= frame.width - 0.00001);
            assert.ok(geometry.top + geometry.height >= frame.height - 0.00001);
            assert.ok(
              Math.abs(
                geometry.width / geometry.height - source.width / source.height,
              ) < 0.00001,
            );
          }
});

test("dragging follows the pointer, clamps at the edges and ignores axes with no overflow", () => {
  const initial = { zoom: 2, positionX: 50, positionY: 50 };
  const source = { width: 400, height: 400 },
    frame = { width: 200, height: 200 };
  assert.deepEqual(
    dragImageFraming(initial, source, frame, { x: 50, y: -50 }),
    { zoom: 2, positionX: 25, positionY: 75 },
  );
  assert.deepEqual(
    dragImageFraming(initial, source, frame, { x: 10000, y: -10000 }),
    { zoom: 2, positionX: 0, positionY: 100 },
  );
  assert.deepEqual(
    dragImageFraming({ ...initial, zoom: 1 }, source, frame, { x: 50, y: 50 }),
    { ...initial, zoom: 1 },
  );
  assert.deepEqual(initial, { zoom: 2, positionX: 50, positionY: 50 });
});

test("CSS uses the same bounded object position and scale origin as the drag calculations", () => {
  assert.deepEqual(
    getImageFramingStyle({
      framing: { zoom: 2.25, positionX: 20, positionY: 75 },
    }),
    {
      objectFit: "cover",
      objectPosition: "20% 75%",
      transform: "scale(2.25)",
      transformOrigin: "20% 75%",
    },
  );
});
