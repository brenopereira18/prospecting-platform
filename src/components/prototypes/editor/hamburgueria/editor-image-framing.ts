import type {
  ImageFraming,
  ImageReference,
} from "../../schemas/prototype-base.schema";
import type { ImageSize } from "../../templates/hamburgueria/lib/image-framing";
import type { EditorImageTarget } from "./editor-images";

export type FramingViewport = {
  frame: ImageSize;
  visible: ImageSize & { left: number; top: number };
  defaults: ImageFraming;
};

export const getEditorImageSlot = (target: EditorImageTarget) =>
  target.kind === "product" ? `product:${target.productId}` : target.kind;

/** Stable editor markers, independent of business text or presentation classes. */
export function readFramingViewport(
  owner: Document,
  target: EditorImageTarget,
  image: ImageReference,
): FramingViewport {
  const preview = owner.querySelector<HTMLIFrameElement>(
    "iframe[data-hamburgueria-preview]",
  )?.contentDocument;
  const element = [
    ...(preview?.querySelectorAll<HTMLElement>("[data-image-slot]") ?? []),
  ].find((node) => node.dataset.imageSlot === getEditorImageSlot(target));
  const viewportWidth = preview?.documentElement.clientWidth || 1200;
  const defaults: ImageFraming = { zoom: 1, positionX: 50, positionY: 50 };
  if (target.kind === "hero") {
    defaults.positionX = viewportWidth <= 700 ? 61 : 50;
    defaults.positionY =
      viewportWidth <= 700 || viewportWidth >= 1600
        ? 55
        : viewportWidth <= 1150
          ? 50
          : 51;
  } else if (target.kind === "story") {
    defaults.positionX = viewportWidth <= 700 ? 20 : 25;
    defaults.positionY = 60;
  }
  const fallback =
    target.kind === "product"
      ? { width: 112, height: 112 }
      : target.kind === "story"
        ? { width: 640, height: 510 }
        : target.kind === "location"
          ? { width: 580, height: 230 }
          : { width: 1440, height: 700 };
  const bounds = element?.getBoundingClientRect();
  if (!element || !bounds?.width || !bounds.height)
    return {
      frame: fallback,
      visible: { ...fallback, left: 0, top: 0 },
      defaults,
    };
  // A hero photograph can extend past its clipping section; preview only its visible intersection.
  const clip =
    element
      .closest<HTMLElement>("[data-image-viewport]")
      ?.getBoundingClientRect() ?? bounds;
  const left = Math.max(bounds.left, clip.left),
    top = Math.max(bounds.top, clip.top);
  const width = Math.min(bounds.right, clip.right) - left,
    height = Math.min(bounds.bottom, clip.bottom) - top;
  if (width <= 0 || height <= 0)
    return {
      frame: fallback,
      visible: { ...fallback, left: 0, top: 0 },
      defaults,
    };
  if (!image.focalPoint) {
    const position = element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .objectPosition.split(" ");
    if (
      position?.length === 2 &&
      position.every((value) => /^\d+(\.\d+)?%$/.test(value))
    ) {
      defaults.positionX = parseFloat(position[0]);
      defaults.positionY = parseFloat(position[1]);
    }
  }
  return {
    frame: { width: bounds.width, height: bounds.height },
    visible: { width, height, left: bounds.left - left, top: bounds.top - top },
    defaults,
  };
}
