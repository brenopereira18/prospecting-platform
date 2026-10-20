import { Fragment } from "react";

/** Keep authored line breaks only between nonempty lines. */
export function TextLines({ lines, breakClassName }: { lines: readonly string[]; breakClassName?: string }) {
  return lines.filter(line => line.trim()).map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br className={breakClassName} />}
      {line}
    </Fragment>
  ));
}
