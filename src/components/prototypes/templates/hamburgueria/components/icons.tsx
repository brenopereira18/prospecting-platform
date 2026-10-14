import type { SVGProps } from "react";

export type IconName =
  | "burger"
  | "bag"
  | "arrow"
  | "pin"
  | "fire"
  | "fries"
  | "leaf"
  | "clock"
  | "truck"
  | "check"
  | "close"
  | "dessert"
  | "cup";
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg aria-hidden="true" {...props}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
export function IconLibrary() {
  return (
    <svg
      className={"svg-library hidden"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <symbol id="i-burger" viewBox="0 0 48 48">
        <path d="M5 19C6 3 42 3 43 19H5Z M6 27h36 M5 35h38c0 8-38 8-38 0Z M5 22l9 3 10-3 10 3 9-3" />
        <path d="m17 12 1 1m7-3 1 1m7 2 1 1" />
      </symbol>
      <symbol id="i-bag" viewBox="0 0 24 24">
        <path d="M5 7h14l1 14H4L5 7Z M8 8V6a4 4 0 0 1 8 0v2" />
      </symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24">
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </symbol>
      <symbol id="i-pin" viewBox="0 0 24 24">
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </symbol>
      <symbol id="i-fire" viewBox="0 0 24 24">
        <path d="M13 2c2 6-5 7-3 12 2-1 4-3 5-5 8 8 3 13-3 13S2 17 5 11c1 4 2 3 3 3-2-7 6-7 5-12Z" />
      </symbol>
      <symbol id="i-fries" viewBox="0 0 32 32">
        <path d="m6 15 3 15h14l3-15c-6 4-14 4-20 0ZM8 16 6 5l4-1 2 13m2 0V2h4v15m2 0 2-12 4 1-2 10" />
      </symbol>
      <symbol id="i-leaf" viewBox="0 0 24 24">
        <path d="M20 3C4 0 0 17 9 20S23 10 20 3ZM3 23 17 7" />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </symbol>
      <symbol id="i-truck" viewBox="0 0 32 24">
        <path d="M2 3h17v15H2Zm17 5h6l5 6v4H19" />
        <circle cx="8" cy="19" r="3" />
        <circle cx="24" cy="19" r="3" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="m5 12 5 5L20 6" />
      </symbol>
      <symbol id="i-close" viewBox="0 0 24 24">
        <path d="m6 6 12 12M6 18 18 6" />
      </symbol>
      <symbol id="i-dessert" viewBox="0 0 32 32">
        <path d="M5 18h22l-3 11H8L5 18ZM8 18V9h16v9M8 9c0-8 16-8 16 0M5 22h22" />
      </symbol>
      <symbol id="i-cup" viewBox="0 0 24 24">
        <path d="M5 8h14l-2 14H7L5 8ZM4 5h16M13 5l2-4h5" />
      </symbol>
    </svg>
  );
}
