import assert from "node:assert/strict";
import { test } from "node:test";
import { getCarouselBounds } from "./carousel";

test("carousel buttons respect the beginning, middle and end of the track", () => {
  assert.deepEqual(getCarouselBounds(0, 1200, 600), { previous: false, next: true });
  assert.deepEqual(getCarouselBounds(300, 1200, 600), { previous: true, next: true });
  assert.deepEqual(getCarouselBounds(600, 1200, 600), { previous: true, next: false });
  assert.deepEqual(getCarouselBounds(599.5, 1200, 600), { previous: true, next: false });
});

test("empty, single-card, fitting and unmeasured tracks do not offer unnecessary navigation", () => {
  for (const [width, viewport] of [[0, 600], [300, 600], [600, 600], [1200, 0]]) {
    assert.deepEqual(getCarouselBounds(0, width, viewport), { previous: false, next: false });
  }
});
