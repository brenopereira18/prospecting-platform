import type { HamburgueriaPrototypeDocument } from "./schema/hamburgueria.schema";
import { HamburgueriaTemplate } from "./hamburgueria-template";
import { HamburgueriaContent } from "./components/content";
import { prepareUploadImages, type UploadImageResolver } from "./lib/images";

export function HamburgueriaRenderer({
  document,
  resolveUpload,
}: {
  document: HamburgueriaPrototypeDocument;
  resolveUpload?: UploadImageResolver;
}) {
  const uploads = prepareUploadImages(document, resolveUpload);
  return (
    <HamburgueriaTemplate document={document} uploads={uploads}>
      <HamburgueriaContent document={document} />
    </HamburgueriaTemplate>
  );
}
