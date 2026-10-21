"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import type { ImageReference } from "../../../schemas/prototype-base.schema";
import { resolveHamburgueriaImage } from "../lib/images";
import { useHamburgueriaUploads } from "./document-provider";
import { Icon } from "./icons";

export function TemplateImage({
  image,
  style,
  ...props
}: Omit<ImageProps, "src" | "alt"> & { image: ImageReference }) {
  const uploads = useHamburgueriaUploads();
  const resolved = resolveHamburgueriaImage(image, uploads);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageStyle = image.focalPoint
    ? {
        ...style,
        objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%`,
      }
    : style;
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
      >
        <Icon name="burger" />
      </div>
    );
  }
  return (
    <Image
      {...props}
      className={`template-image ${props.className ?? ""}`}
      src={resolved}
      alt={image.alt}
      style={imageStyle}
      // Future remote upload domains do not enter the Next image proxy implicitly.
      unoptimized={
        image.source === "upload" &&
        (resolved.src.startsWith("https:") || resolved.src.startsWith("blob:"))
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
}
