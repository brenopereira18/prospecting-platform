"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import type { ResolvedUploadImages } from "../../templates/hamburgueria/lib/images";
import { TemporaryImageRegistry } from "./temporary-images";

const emptySnapshot: ResolvedUploadImages = {};
const getServerSnapshot = () => emptySnapshot;

export interface TemporaryImagesController {
  uploads: ResolvedUploadImages;
  prepare: TemporaryImageRegistry["prepare"];
  confirm: TemporaryImageRegistry["confirm"];
  discard: TemporaryImageRegistry["discard"];
}

export function useTemporaryImages(document: HamburgueriaPrototypeDocument): TemporaryImagesController {
  const [registry] = useState(() => new TemporaryImageRegistry());
  const uploads = useSyncExternalStore(registry.subscribe, registry.getSnapshot, getServerSnapshot);
  // Prune after React commits the new document and the preview stops using removed references.
  useEffect(() => registry.reconcile(document), [document, registry]);
  // clear is reusable so development Strict Mode can safely replay effect setup/cleanup.
  useEffect(() => () => registry.clear(), [registry]);
  return useMemo(() => ({ uploads, prepare: registry.prepare, confirm: registry.confirm, discard: registry.discard }), [registry, uploads]);
}
