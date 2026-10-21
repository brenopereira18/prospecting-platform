"use client";

import type { ReactNode } from "react";
import { Carousel } from "./carousel";

export function ReviewsLoop({
  count,
  children,
  className = "",
}: {
  count: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Carousel
      id="reviews-carousel"
      label="Avaliações dos clientes"
      kind="reviews"
      count={count}
      className={className}
    >
      {children}
    </Carousel>
  );
}
