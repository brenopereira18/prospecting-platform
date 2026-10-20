"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { getCarouselBounds } from "../lib/carousel";

export function Carousel({ id, label, kind, count, children, className = "" }: {
  id: string; label: string; kind: "products" | "reviews"; count: number; children: ReactNode; className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ previous: false, next: false, index: 0 });

  useEffect(() => {
    const element = track.current;
    const view = element?.ownerDocument.defaultView;
    if (!element || !view) return;
    let frame = 0;
    const measure = () => {
      const card = Array.from(element.children).find(child => !(child as HTMLElement).hidden);
      const step = (card?.getBoundingClientRect().width ?? 0) + (parseFloat(view.getComputedStyle(element).columnGap) || 0);
      const index = step > 0 ? Math.min(Math.max(0, count - 1), Math.max(0, Math.round(element.scrollLeft / step))) : 0;
      const next = { ...getCarouselBounds(element.scrollLeft, element.scrollWidth, element.clientWidth), index };
      setBounds(previous => previous.previous === next.previous && previous.next === next.next && previous.index === next.index ? previous : next);
    };
    const schedule = () => { view.cancelAnimationFrame(frame); frame = view.requestAnimationFrame(measure); };
    const resize = new view.ResizeObserver(schedule);
    const mutation = new view.MutationObserver(schedule);
    resize.observe(element);
    mutation.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    element.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      resize.disconnect(); mutation.disconnect();
      element.removeEventListener("scroll", schedule);
      view.cancelAnimationFrame(frame);
    };
  }, [count]);

  function navigate(direction: -1 | 1, edge?: "start" | "end") {
    const element = track.current;
    const view = element?.ownerDocument.defaultView;
    if (!element || !view) return;
    const card = Array.from(element.children).find(child => !(child as HTMLElement).hidden);
    const gap = parseFloat(view.getComputedStyle(element).columnGap) || 0;
    const step = (card?.getBoundingClientRect().width ?? element.clientWidth) + gap;
    const behavior = view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    if (edge) element.scrollTo({ left: edge === "start" ? 0 : element.scrollWidth, behavior });
    else element.scrollBy({ left: direction * step, behavior });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    navigate(event.key === "ArrowLeft" ? -1 : 1, event.key === "Home" ? "start" : event.key === "End" ? "end" : undefined);
  }

  const sizing = kind === "products"
    ? "[--carousel-gap:22px] max-[1150px]:[--carousel-gap:16px] max-[900px]:[--carousel-gap:22px] auto-cols-[calc((100%_-_3*var(--carousel-gap))/4)]"
    : "[--carousel-gap:24px] max-[900px]:[--carousel-gap:15px] auto-cols-[calc((100%_-_2*var(--carousel-gap))/3)]";
  const buttonClass = `grid h-12 w-12 place-items-center rounded-full border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--yellow)] disabled:cursor-default disabled:opacity-30 ${kind === "reviews" ? "border-white/25 text-[var(--paper)] hover:enabled:bg-white/10" : "border-[var(--line)] text-[var(--ink)] hover:enabled:bg-[var(--yellow)]"}`;
  return (
    <div role="region" aria-roledescription="carrossel" aria-label={label} className="min-w-0">
      <p id={`${id}-instructions`} className="sr-only">Deslize para ver mais. Com o carrossel em foco, use as setas do teclado para navegar.</p>
      <div ref={track} id={id} tabIndex={0} aria-label={label} aria-live="polite" aria-describedby={`${id}-instructions`} onKeyDown={onKeyDown}
        className={`grid grid-flow-col ${sizing} max-[900px]:auto-cols-[calc((100%_-_var(--carousel-gap))/2)] max-[700px]:auto-cols-[86%] touch-auto overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:var(--yellow)_transparent] max-[700px]:[scrollbar-width:none] max-[700px]:[&::-webkit-scrollbar]:hidden pb-3 focus-visible:outline-2 focus-visible:outline-[var(--yellow)] [&_>_article]:snap-start [&_>_article]:min-w-0 [&_>_figure]:snap-start [&_>_figure]:min-w-0 ${count === 0 ? "auto-cols-[100%]! max-[900px]:auto-cols-[100%]! max-[700px]:auto-cols-[100%]!" : ""} ${className}`}>
        {children}
      </div>
      {count > 1 && <div className={`mt-2 hidden items-center justify-center gap-3 max-[700px]:flex ${kind === "reviews" ? "text-[var(--paper)]/70" : "text-[var(--ink)]/70"}`}>
        <span className="text-xs">Deslize para ver mais</span>
        <div aria-hidden="true" className={`h-1 w-16 overflow-hidden rounded-full ${kind === "reviews" ? "bg-white/20" : "bg-[var(--ink)]/15"}`}>
          <div className="h-full rounded-full bg-[var(--yellow)]" style={{ width: `${((Math.min(bounds.index, count - 1) + 1) / count) * 100}%` }} />
        </div>
        <span aria-label={`Item ${Math.min(bounds.index, count - 1) + 1} de ${count}`} className="text-xs tabular-nums">{Math.min(bounds.index, count - 1) + 1} / {count}</span>
      </div>}
      {count > 1 && <div hidden={!bounds.previous && !bounds.next} className="mt-4 flex justify-end gap-2 max-[700px]:hidden">
        {([[-1, kind === "products" ? "Produtos anteriores" : "Avaliações anteriores"], [1, kind === "products" ? "Próximos produtos" : "Próximas avaliações"]] as const).map(([direction, label]) => (
          <button key={direction} type="button" className={buttonClass} aria-label={label} aria-controls={id} disabled={direction === -1 ? !bounds.previous : !bounds.next} onClick={() => navigate(direction)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={direction === -1 ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} /></svg>
          </button>
        ))}
      </div>}
    </div>
  );
}
