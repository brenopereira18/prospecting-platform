"use client";

import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";

export function ReviewsLoop({ count, children, className = "" }: {
  count: number; children: ReactNode; className?: string;
}) {
  const looping = count > 1;
  // Each half must fill at least the three-card desktop viewport.
  const filler = count === 2 ? Children.toArray(children).map((child, index) => isValidElement(child)
    ? cloneElement(child as ReactElement<{ "aria-hidden"?: boolean; inert?: boolean }>, { key: `filler-${index}`, "aria-hidden": true, inert: true })
    : null) : null;
  return (
    <div role="region" aria-roledescription="carrossel" aria-label="Avaliações dos clientes"
      className={`reviews-loop ${className}`} data-looping={looping}
      style={{ "--reviews-duration": `${Math.max(30, count * 12)}s` } as CSSProperties}>
      <div className="reviews-loop-viewport" tabIndex={0} aria-label="Avaliações dos clientes">
        <div id="reviews-carousel" className="reviews-loop-track">
          <div className="reviews-loop-group">{children}{filler}</div>
          {looping && <div className="reviews-loop-group reviews-loop-copy" aria-hidden="true" inert>{children}{filler}</div>}
        </div>
      </div>
    </div>
  );
}
