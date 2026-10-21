import type { CSSProperties } from "react";
import type {
  ImageFraming,
  ImageReference,
} from "../../../schemas/prototype-base.schema";

export type ImageSize = { width: number; height: number };
export const defaultImageFraming: ImageFraming = {
  zoom: 1,
  positionX: 50,
  positionY: 50,
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
type FramingImage =
  | ImageReference
  | Pick<ImageReference, "framing" | "focalPoint">;

export function getImageFraming(
  image: FramingImage,
  defaults = defaultImageFraming,
): ImageFraming {
  return image.framing
    ? { ...image.framing }
    : {
        zoom: 1,
        positionX: image.focalPoint?.x ?? defaults.positionX,
        positionY: image.focalPoint?.y ?? defaults.positionY,
      };
}

/** Bitmap bounds inside the untransformed frame; scale never exposes a blank edge. */
export function getImageFramingGeometry(
  source: ImageSize,
  frame: ImageSize,
  framing: ImageFraming,
) {
  const scale =
    Math.max(frame.width / source.width, frame.height / source.height) *
    framing.zoom;
  const width = source.width * scale,
    height = source.height * scale;
  return {
    width,
    height,
    left: ((frame.width - width) * framing.positionX) / 100,
    top: ((frame.height - height) * framing.positionY) / 100,
  };
}

export function dragImageFraming(
  framing: ImageFraming,
  source: ImageSize,
  frame: ImageSize,
  delta: { x: number; y: number },
): ImageFraming {
  const bounds = getImageFramingGeometry(source, frame, framing);
  const x = bounds.width - frame.width,
    y = bounds.height - frame.height;
  return {
    ...framing,
    positionX:
      x > 0.00001
        ? clamp(framing.positionX - (delta.x / x) * 100, 0, 100)
        : framing.positionX,
    positionY:
      y > 0.00001
        ? clamp(framing.positionY - (delta.y / y) * 100, 0, 100)
        : framing.positionY,
  };
}

/** Matching object-position and transform-origin yields exactly the bitmap bounds above. */
export function getImageFramingStyle(
  image: FramingImage,
): CSSProperties | undefined {
  if (!image.framing)
    return image.focalPoint
      ? { objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%` }
      : undefined;
  const { zoom, positionX, positionY } = image.framing;
  const position = `${positionX}% ${positionY}%`;
  return {
    objectFit: "cover",
    objectPosition: position,
    transform: `scale(${zoom})`,
    transformOrigin: position,
  };
}
