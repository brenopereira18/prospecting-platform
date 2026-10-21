import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";

type Colors = HamburgueriaPrototypeDocument["appearance"]["colors"];
export const COLOR_SURFACES = [
  "page",
  "card",
  "soft",
  "secondary",
  "deep",
  "brand",
] as const;

function rgb(hex: string): number[] {
  const value = hex.slice(1);
  const full =
    value.length === 3
      ? [...value].map((channel) => channel + channel).join("")
      : value;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
}

function mix(from: string, to: string, amount: number): string {
  const target = rgb(to);
  return `#${rgb(from)
    .map((channel, index) =>
      Math.round(channel + (target[index] - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance(hex: string): number {
  const linear = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** WCAG relative luminance for opaque sRGB colors. */
export function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function readable(
  preferred: string,
  background: string,
  minimum = 4.6,
): string {
  if (contrastRatio(preferred, background) >= minimum) return preferred;
  const end =
    contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
      ? "#000000"
      : "#ffffff";
  // Keep the original hue as far as possible, accounting for rounded sRGB channels.
  for (let step = 1; step <= 100; step++) {
    const candidate = mix(preferred, end, step / 100);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return end;
}

/** Derived only at render time: the document retains exactly the three chosen colors. */
export function getHamburgueriaColorStyles(
  colors: Colors,
): Record<`--${string}`, string> {
  const { primary, secondary, tertiary } = colors;
  const pageText = readable(secondary, tertiary);
  const surfaces = {
    page: tertiary,
    card: mix(
      tertiary,
      luminance(tertiary) > 0.5 ? "#ffffff" : "#000000",
      0.65,
    ),
    soft: mix(tertiary, pageText, 0.04),
    secondary,
    deep: mix(secondary, "#000000", 0.4),
    brand: primary,
  };
  const styles: Record<`--${string}`, string> = {
    "--template-primary": primary,
    "--template-secondary": secondary,
    "--template-tertiary": tertiary,
  };
  for (const scope of COLOR_SURFACES) {
    const background = surfaces[scope];
    const text = readable(
      scope === "secondary" || scope === "deep" ? tertiary : secondary,
      background,
    );
    const hover = mix(background, text, 0.06);
    const tokens = {
      surface: background,
      text,
      muted: readable(mix(text, background, 0.35), background),
      accent: readable(primary, background),
      line: mix(background, text, 0.16),
      "control-border": readable(primary, background, 3.1),
      hover,
      "hover-text": readable(text, hover),
      focus: readable(primary, background, 3.1),
    };
    for (const [name, value] of Object.entries(tokens))
      styles[`--${scope}-${name}`] = value;
  }
  const brandHover = mix(primary, readable(secondary, primary), 0.08);
  const secondaryHover = mix(secondary, readable(tertiary, secondary), 0.08);
  return {
    ...styles,
    "--brand": primary,
    "--on-brand": styles["--brand-text"],
    "--action-primary-hover": brandHover,
    "--on-action-primary-hover": readable(secondary, brandHover),
    "--secondary": secondary,
    "--on-secondary": styles["--secondary-text"],
    "--action-secondary-hover": secondaryHover,
    "--on-action-secondary-hover": readable(tertiary, secondaryHover),
  };
}
