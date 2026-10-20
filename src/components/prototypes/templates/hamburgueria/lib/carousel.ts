export function getCarouselBounds(left: number, width: number, viewport: number) {
  const max = Math.max(0, width - viewport);
  return { previous: viewport > 0 && left > 2, next: viewport > 0 && left < max - 2 };
}
