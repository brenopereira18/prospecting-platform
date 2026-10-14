/** Utility groups for state-dependent class names in navigation and menu. */
const utilities: Record<string, string> = {
  navigation:
    "flex items-center [gap:30px] [margin-left:auto] [&_a]:[font:600_16px_var(--display)] [&_a]:relative [&_a]:[padding:12px_0] [&_a:hover]:[color:var(--yellow)] [&_a.nav-active]:[color:var(--yellow)] [&_.nav-active:after]:absolute [&_.nav-active:after]:[bottom:5px] [&_.nav-active:after]:[left:0] [&_.nav-active:after]:w-full [&_.nav-active:after]:[height:2px] [&_.nav-active:after]:[background:var(--yellow)] max-[1150px]:[gap:20px] max-[900px]:[gap:15px] max-[900px]:[&_a]:[font-size:15px] max-[700px]:hidden max-[700px]:[order:3] max-[700px]:w-full max-[700px]:[margin:0] max-[700px]:[padding:0_0_17px] max-[700px]:flex-wrap max-[700px]:[gap:7px_25px] max-[700px]:[border-top:1px_solid_#ffffff20] max-[700px]:[&.open]:flex max-[700px]:[&_a]:[font-size:18px] max-[700px]:[&_a]:[padding:14px_0_3px] max-[700px]:[&_.nav-active:after]:hidden",
  "menu-tab":
    "[padding:9px_18px] [border:1px_solid_#d7d2c8] [background:transparent] rounded-[3px] [font-size:14px] font-semibold [transition:background_0.15s] [&.active]:[background:var(--ink)] [&.active]:[border-color:var(--ink)] [&.active]:[color:white] [&:hover:not(.active)]:[background:#e8e2d5] max-[700px]:[font-size:12px] max-[700px]:[padding:9px_13px] max-[700px]:[min-height:39px] max-[360px]:[padding:8px_10px]",
  "product-card":
    "[border:1px_solid_#e3ded4] [background:#fffefa] rounded-md overflow-hidden [box-shadow:0_4px_10px_#30200a07] flex flex-col [&:hover_.product-image_img]:[transform:scale(1.035)]",
  "simple-product":
    "[&_.product-image]:[background:#eae4d8] [&_.product-image]:grid [&_.product-image]:place-items-center [&_.product-image]:[color:#967337] [&_.product-image]:[aspect-ratio:1.5] [&_.product-image_svg]:[width:80px] [&_.product-image_svg]:[height:80px] [&_.product-image_svg]:[stroke-width:1]",
  "product-badge":
    "absolute [left:12px] [top:12px] [background:var(--yellow)] [padding:4px_10px] [color:var(--ink)] [font-size:10px] font-bold rounded-[2px] [line-height:1.5] [&.vegetarian]:[background:#d8e3b5] max-[700px]:[left:7px] max-[700px]:[top:7px] max-[700px]:[font-size:8px] max-[700px]:[padding:3px_6px]",
};

export function tw(classNames: string | undefined): string | undefined {
  if (!classNames) return undefined;
  return classNames
    .split(/\s+/)
    .map((name) => [name, utilities[name]].filter(Boolean).join(" "))
    .join(" ");
}
