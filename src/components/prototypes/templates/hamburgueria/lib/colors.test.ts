import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COLOR_SURFACES,
  contrastRatio,
  getHamburgueriaColorStyles,
} from "./colors";
import { brasaBurgerDefaultDocument } from "../data/default-document";

test("brand colors are not hardcoded in template components or utility groups", () => {
  for (const file of [
    "components/header.tsx",
    "components/menu.tsx",
    "components/sections.tsx",
    "components/interaction-provider.tsx",
    "styles/tailwind.ts",
    "hamburgueria.css",
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /#(?:ffcc33|9d6500|c98b00|d8e3b5|ba901f|a57915)\b/i,
      file,
    );
  }
});

test("contrast follows WCAG sRGB luminance, including shorthand hex", () => {
  assert.equal(contrastRatio("#000", "#fff"), 21);
  assert.equal(contrastRatio("#123456", "#123456"), 1);
  assert.ok(Math.abs(contrastRatio("#777777", "#ffffff") - 4.478) < 0.001);
});

test("default brand palette and source document stay unchanged", () => {
  const before = structuredClone(brasaBurgerDefaultDocument);
  const colors = brasaBurgerDefaultDocument.appearance.colors;
  const tokens = getHamburgueriaColorStyles(colors);
  assert.deepEqual(colors, {
    primary: "#f5bb16",
    secondary: "#141413",
    tertiary: "#f6f3ec",
  });
  assert.equal(tokens["--brand"], colors.primary);
  assert.equal(tokens["--secondary-surface"], colors.secondary);
  assert.equal(tokens["--page-surface"], colors.tertiary);
  assert.equal(tokens["--deep-surface"], "#0c0c0b");
  assert.equal(tokens["--page-text"], colors.secondary);
  assert.deepEqual(brasaBurgerDefaultDocument, before);
});

test("each editable color controls its intended base surface independently", () => {
  const original = brasaBurgerDefaultDocument.appearance.colors;
  for (const field of ["primary", "secondary", "tertiary"] as const) {
    const changed = getHamburgueriaColorStyles({
      ...original,
      [field]: "#386ada",
    });
    assert.equal(changed[`--template-${field}`], "#386ada");
    for (const other of ["primary", "secondary", "tertiary"] as const)
      if (other !== field)
        assert.equal(changed[`--template-${other}`], original[other]);
    assert.equal(
      changed["--brand"],
      field === "primary" ? "#386ada" : original.primary,
    );
    assert.equal(
      changed["--secondary-surface"],
      field === "secondary" ? "#386ada" : original.secondary,
    );
    assert.equal(
      changed["--page-surface"],
      field === "tertiary" ? "#386ada" : original.tertiary,
    );
  }
});

test("text, accents, badges and hover states meet AA across light, dark, identical and saturated palettes", () => {
  const samples = [
    "#000",
    "#fff",
    "#777777",
    "#f00",
    "#0f0",
    "#00f",
    "#ffff00",
  ];
  for (const primary of samples)
    for (const secondary of samples)
      for (const tertiary of samples) {
        const tokens = getHamburgueriaColorStyles({
          primary,
          secondary,
          tertiary,
        });
        for (const surface of COLOR_SURFACES) {
          for (const foreground of ["text", "muted", "accent"])
            assert.ok(
              contrastRatio(
                tokens[`--${surface}-${foreground}`],
                tokens[`--${surface}-surface`],
              ) >= 4.5,
              `${primary}/${secondary}/${tertiary}: ${surface}/${foreground}`,
            );
          for (const foreground of ["focus", "control-border"])
            assert.ok(
              contrastRatio(
                tokens[`--${surface}-${foreground}`],
                tokens[`--${surface}-surface`],
              ) >= 3,
            );
          assert.ok(
            contrastRatio(
              tokens[`--${surface}-hover-text`],
              tokens[`--${surface}-hover`],
            ) >= 4.5,
          );
        }
        for (const [foreground, background] of [
          ["--on-brand", "--brand"],
          ["--on-secondary", "--secondary"],
          ["--on-action-primary-hover", "--action-primary-hover"],
          ["--on-action-secondary-hover", "--action-secondary-hover"],
        ] as const)
          assert.ok(
            contrastRatio(tokens[foreground], tokens[background]) >= 4.5,
            `${foreground}/${background}`,
          );
      }
});

test("fixed colors are limited to illustration details, shadows and the modal backdrop", () => {
  for (const file of [
    "components/header.tsx",
    "components/menu.tsx",
    "components/sections.tsx",
    "components/carousel.tsx",
    "components/content.tsx",
    "components/template-image.tsx",
    "components/interaction-provider.tsx",
    "styles/tailwind.ts",
    "hamburgueria.css",
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /var\(--(?:yellow|yellow-dark|ink|paper|black)\)|\[color:(?:white|black)\]|(?:bg|text|border)-white/,
    );
    for (const line of source.split("\n")) {
      if (/"(?:location-map|map-park|map-street) /.test(line)) continue;
      const withoutShadows = line.replace(
        /\[box-shadow:[^\]]+\]|\[&::backdrop\]:\[background:[^\]]+\]/g,
        "",
      );
      assert.doesNotMatch(
        withoutShadows,
        /#[\da-f]{3,8}\b/i,
        `${file}: only semantic colors belong here`,
      );
    }
  }
});
