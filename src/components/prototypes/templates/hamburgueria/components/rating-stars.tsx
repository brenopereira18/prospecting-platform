import type { HTMLAttributes } from "react";
import { formatCopy } from "../lib/format";

export function RatingStars({
  rating,
  label,
  locale,
  className,
}: {
  rating: number;
  label: string;
  locale: string;
  className?: HTMLAttributes<HTMLSpanElement>["className"];
}) {
  const safeRating = Math.max(0, Math.min(5, rating));
  return (
    <span
      className={className}
      role="img"
      aria-label={formatCopy(label, {
        rating: safeRating.toLocaleString(locale),
      })}
      style={{
        display: "inline-block",
        position: "relative",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">☆☆☆☆☆</span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: `${safeRating * 20}%`,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        ★★★★★
      </span>
    </span>
  );
}
