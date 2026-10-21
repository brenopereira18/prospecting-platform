"use client";

import Image, { type StaticImageData } from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Move, RotateCcw, X, ZoomIn } from "lucide-react";
import type {
  ImageFraming,
  ImageReference,
} from "../../schemas/prototype-base.schema";
import {
  dragImageFraming,
  getImageFraming,
  getImageFramingStyle,
  type ImageSize,
} from "../../templates/hamburgueria/lib/image-framing";
import type { FramingViewport } from "./editor-image-framing";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sidebar-hover px-4 text-sm font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

export function EditorImageFramingDialog({
  image,
  resolved,
  viewport,
  label,
  onApply,
  onCancel,
}: {
  image: ImageReference;
  resolved: StaticImageData;
  viewport: FramingViewport;
  label: string;

  onApply: (value: ImageFraming) => void;
  onCancel: () => void;
}) {
  const title = useId(),
    instructions = useId(),
    zoomId = useId();
  const dialog = useRef<HTMLDialogElement>(null),
    frame = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() =>
    getImageFraming(image, viewport.defaults),
  );
  const [dragging, setDragging] = useState(false);
  const [failedSource, setFailedSource] = useState<string>();
  const failed = failedSource === resolved.src;
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    framing: ImageFraming;
    size: ImageSize;
  } | null>(null);

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      if (modal?.open) modal.close();
    };
  }, []);

  function cancel() {
    dialog.current?.close();
    onCancel();
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || failed || !frame.current)
      return;
    const size = frame.current.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      framing: { ...draft },
      size,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setDraft(
      dragImageFraming(start.framing, resolved, start.size, {
        x: event.clientX - start.x,
        y: event.clientY - start.y,
      }),
    );
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const delta = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key];
    if (!delta || !frame.current || failed) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    const size = frame.current.getBoundingClientRect();
    setDraft((previous) =>
      dragImageFraming(previous, resolved, size, {
        x: delta.x * step,
        y: delta.y * step,
      }),
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClose={() => {
        if (!dialog.current?.open) onCancel();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-sidebar-hover bg-card text-foreground shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-sidebar-hover px-5 py-4">
        <div>
          <p role="status" className="sr-only">
            Posição horizontal {Math.round(draft.positionX)}%, vertical{" "}
            {Math.round(draft.positionY)}%.
          </p>
          <h2 id={title} className="text-lg font-semibold">
            Ajustar imagem
          </h2>
          <p className="mt-1 text-sm text-secundary">{label}</p>
        </div>
        <button
          type="button"
          aria-label="Fechar sem aplicar"
          className={`${button} px-3`}
          onClick={cancel}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-5 p-5">
        <p
          id={instructions}
          className="flex items-start gap-2 text-xs leading-5 text-secundary"
        >
          <Move size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Arraste a fotografia para reposicionar. Com o teclado, use as setas;
          Shift move mais rápido.
        </p>
        <div className="grid place-items-center rounded-xl border border-sidebar-hover bg-background p-2 sm:p-4">
          <div
            className="w-full"
            style={{
              maxWidth: Math.min(
                560,
                (360 * viewport.visible.width) / viewport.visible.height,
              ),
            }}
          >
            <div
              tabIndex={0}
              role="group"
              aria-label="Prévia do enquadramento"
              aria-describedby={instructions}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onLostPointerCapture={stopDrag}
              onKeyDown={moveWithKeyboard}
              className={`relative w-full touch-none select-none overflow-hidden rounded-md ring-1 ring-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{
                aspectRatio: `${viewport.visible.width}/${viewport.visible.height}`,
              }}
            >
              <div
                ref={frame}
                className="pointer-events-none absolute overflow-hidden"
                style={{
                  width: `${(viewport.frame.width / viewport.visible.width) * 100}%`,
                  height: `${(viewport.frame.height / viewport.visible.height) * 100}%`,
                  left: `${(viewport.visible.left / viewport.visible.width) * 100}%`,
                  top: `${(viewport.visible.top / viewport.visible.height) * 100}%`,
                }}
              >
                <Image
                  src={resolved}
                  alt={image.alt}
                  width={resolved.width}
                  height={resolved.height}
                  draggable={false}
                  unoptimized={image.source === "upload"}
                  sizes="600px"
                  className="block h-full w-full max-w-none"
                  style={getImageFramingStyle({ framing: draft })}
                  onError={() => setFailedSource(resolved.src)}
                />
              </div>
              {failed && (
                <p
                  role="alert"
                  className="absolute inset-0 grid place-items-center bg-background p-4 text-center text-sm text-secundary"
                >
                  Não foi possível carregar a imagem. Feche e tente novamente.
                </p>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor={zoomId}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <ZoomIn size={17} aria-hidden="true" />
              Zoom
            </label>
            <output
              htmlFor={zoomId}
              className="text-sm tabular-nums text-secundary"
            >
              {Math.round(draft.zoom * 100)}%
            </output>
          </div>
          <input
            autoFocus
            id={zoomId}
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={draft.zoom}
            disabled={failed}
            aria-valuetext={`${Math.round(draft.zoom * 100)}%`}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                zoom: Number(event.target.value),
              }))
            }
            className="min-h-8 w-full cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          />
          <div className="mt-1 flex justify-between text-[11px] text-secundary">
            <span>100%</span>
            <span>300%</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-hover px-5 py-4">
        <button
          type="button"
          className={`${button} border-transparent text-secundary`}
          onClick={() => setDraft({ ...viewport.defaults })}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Restaurar
        </button>
        <div className="flex gap-2">
          <button type="button" className={button} onClick={cancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={failed}
            className={`${button} border-transparent bg-primary font-semibold text-background enabled:hover:bg-primary/90`}
            onClick={() => {
              dialog.current?.close();
              onApply({ ...draft });
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </dialog>
  );
}
