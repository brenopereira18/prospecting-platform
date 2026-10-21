"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import type { ImageReference } from "../../../schemas/prototype-base.schema";
import { resolveHamburgueriaImage } from "../lib/images";
import { useHamburgueriaUploads } from "./document-provider";
import { Icon } from "./icons";
import { getImageFramingStyle } from "../lib/image-framing";

export function TemplateImage({
  image,
  style,
  imageSlot,
  ...props
}: Omit<ImageProps, "src" | "alt"> & {
  image: ImageReference;
  imageSlot?: string;
}) {
  const uploads = useHamburgueriaUploads();
  const resolved = resolveHamburgueriaImage(image, uploads);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageStyle = { ...style, ...getImageFramingStyle(image) };
  if (!resolved || failedSource === resolved.src) {
    return (
      <div
        className={`template-image grid place-items-center [color:var(--secondary-accent)] [background:var(--secondary)] ${props.className ?? ""}`}
        style={{
          aspectRatio: `${props.width ?? 1}/${props.height ?? 1}`,
          ...imageStyle,
        }}
        role="img"
        aria-label={image.alt}
        data-image-status="unresolved"
        data-image-slot={imageSlot}
      >
        <Icon name="burger" />
      </div>
    );
  }
  const photograph = (
    <Image
      {...props}
      className={
        image.framing
          ? "block h-full w-full max-w-none"
          : `template-image ${props.className ?? ""}`
      }
      data-image-slot={image.framing ? undefined : imageSlot}
      src={resolved}
      alt={image.alt}
      style={
        image.framing
          ? { ...imageStyle, width: "100%", height: "100%" }
          : imageStyle
      }
      // Future remote upload domains do not enter the Next image proxy implicitly.
      unoptimized={
        image.source === "upload" &&
        (resolved.src.startsWith("https:") ||
          resolved.src.startsWith("blob:") ||
          resolved.src.startsWith("/api/prototipos/"))
          ? true
          : props.unoptimized
      }
      onError={() => {
        console.warn(
          `Falha ao carregar imagem da hamburgueria: ${image.source === "template" ? image.key : image.assetId}`,
        );
        setFailedSource(resolved.src);
      }}
    />
  );
  if (!image.framing) return photograph;
  return (
    <div
      data-image-slot={imageSlot}
      className={`template-image overflow-hidden ${props.className ?? ""}`}
      style={{
        aspectRatio: `${props.width ?? resolved.width}/${props.height ?? resolved.height}`,
        ...style,
        overflow: "hidden",
      }}
    >
      {photograph}
    </div>
  );
}
