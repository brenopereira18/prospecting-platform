/** Utilities for state-dependent menu tab class names. */
const utilities: Record<string, string> = {
  "menu-tab":
    "[padding:9px_18px] [border:1px_solid_var(--control-border)] [background:transparent] rounded-[3px] [font-size:14px] font-semibold [transition:background_0.15s] [&.active]:[background:var(--brand)] [&.active]:[border-color:var(--control-border)] [&.active]:[color:var(--on-brand)] [&:hover:not(.active)]:[background:var(--hover)] [&:hover:not(.active)]:[color:var(--hover-text)] max-[700px]:[font-size:12px] max-[700px]:[padding:9px_13px] max-[700px]:[min-height:44px] max-[360px]:[padding:8px_10px]",
};

export function tw(classNames: string | undefined): string | undefined {
  if (!classNames) return undefined;
  return classNames
    .split(/\s+/)
    .map((name) => [name, utilities[name]].filter(Boolean).join(" "))
    .join(" ");
}
