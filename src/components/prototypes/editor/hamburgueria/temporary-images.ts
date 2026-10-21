import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import type { ResolvedUploadImage, ResolvedUploadImages } from "../../templates/hamburgueria/lib/images";
import { getHamburgueriaImageReferences } from "../../templates/hamburgueria/lib/image-references";

export const MAX_TEMPORARY_IMAGE_BYTES = 5 * 1024 * 1024;
export const TEMPORARY_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const TEMPORARY_IMAGE_NOTICE = "As imagens enviadas são temporárias e serão perdidas ao recarregar a página.";

export function validateTemporaryImageFile(file: Pick<File, "name" | "type" | "size">): string | null {
  const types: Record<string, RegExp> = { "image/jpeg": /\.jpe?g$/i, "image/png": /\.png$/i, "image/webp": /\.webp$/i };
  if (!Object.hasOwn(types, file.type) || !types[file.type].test(file.name)) return "Selecione uma imagem JPG/JPEG, PNG ou WebP.";
  if (file.size <= 0) return "O arquivo está vazio. Selecione outra imagem.";
  if (file.size > MAX_TEMPORARY_IMAGE_BYTES) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

function matchesImageHeader(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && bytes.length >= 12 && [0x52, 0x49, 0x46, 0x46].every((byte, index) => bytes[index] === byte)
    && [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[index + 8] === byte);
}

export function getDocumentUploadIds(document: HamburgueriaPrototypeDocument): Set<string> {
  return new Set(getHamburgueriaImageReferences(document).flatMap(({ image }) => image?.source === "upload" ? [image.assetId] : []));
}

type Dimensions = { width: number; height: number };
export type TemporaryImage = ResolvedUploadImage & { temporary: true };
export type PreparedTemporaryImage = { assetId: string; image: TemporaryImage; name: string };

export interface TemporaryImageDependencies {
  createURL: (file: File) => string;
  revokeURL: (url: string) => void;
  dimensions: (url: string, signal?: AbortSignal) => Promise<Dimensions>;
  createId: () => string;
}

/** Decode before confirmation: a MIME label alone does not make an image readable. */
export function readTemporaryImageDimensions(url: string, signal?: AbortSignal): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Seleção cancelada.", "AbortError")); return; }
    const image = new window.Image();
    const cleanup = () => {
      image.onload = image.onerror = null;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      image.src = "";
    };
    const abort = () => { cleanup(); reject(new DOMException("Seleção cancelada.", "AbortError")); };
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Não foi possível ler a imagem. Selecione outro arquivo.")); }, 15_000);
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      cleanup();
      resolve(dimensions);
    };
    image.onerror = () => { cleanup(); reject(new Error("O arquivo não pôde ser aberto como imagem. Selecione outro arquivo.")); };
    signal?.addEventListener("abort", abort, { once: true });
    image.src = url;
  });
}

const browserDependencies: TemporaryImageDependencies = {
  createURL: file => URL.createObjectURL(file),
  revokeURL: url => URL.revokeObjectURL(url),
  dimensions: readTemporaryImageDimensions,
  createId: () => `local-${crypto.randomUUID()}`,
};

/** Owns resources, not document content. Pending previews survive until confirmed or cancelled. */
export class TemporaryImageRegistry {
  private entries = new Map<string, { src: string; image?: TemporaryImage; pending: boolean; file: File }>();
  private listeners = new Set<() => void>();
  private snapshot: ResolvedUploadImages = {};

  constructor(private dependencies: TemporaryImageDependencies = browserDependencies) {}

  getSnapshot = () => this.snapshot;
  getFile = (assetId: string): File | undefined => {
    const entry = this.entries.get(assetId);
    return entry && !entry.pending ? entry.file : undefined;
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private notify() {
    this.snapshot = Object.fromEntries([...this.entries].flatMap(([id, entry]) => entry.image ? [[id, entry.image]] : []));
    this.listeners.forEach(listener => listener());
  }

  private release(assetId: string) {
    const entry = this.entries.get(assetId);
    if (!entry) return;
    this.entries.delete(assetId);
    this.dependencies.revokeURL(entry.src);
  }

  prepare = async (file: File, signal?: AbortSignal): Promise<PreparedTemporaryImage> => {
    const error = validateTemporaryImageFile(file);
    if (error) throw new Error(error);
    if (signal?.aborted) throw new DOMException("Seleção cancelada.", "AbortError");
    const assetId = this.dependencies.createId();
    const src = this.dependencies.createURL(file);
    const entry = { src, pending: true, image: undefined as TemporaryImage | undefined, file };
    this.entries.set(assetId, entry);
    const cancel = () => this.discard(assetId);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (signal?.aborted || this.entries.get(assetId) !== entry) throw new DOMException("Seleção cancelada.", "AbortError");
      if (!matchesImageHeader(file.type, header)) throw new Error("O conteúdo do arquivo não corresponde a uma imagem JPG/JPEG, PNG ou WebP válida.");
      const { width, height } = await this.dependencies.dimensions(src, signal);
      if (signal?.aborted || this.entries.get(assetId) !== entry) throw new DOMException("Seleção cancelada.", "AbortError");
      if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error("Não foi possível identificar as dimensões da imagem.");
      entry.image = { src, width, height, temporary: true };
      this.notify();
      return { assetId, image: entry.image, name: file.name };
    } catch (cause) {
      this.discard(assetId);
      throw cause;
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
  };

  confirm = (assetId: string): boolean => {
    const entry = this.entries.get(assetId);
    if (!entry?.image) return false;
    entry.pending = false;
    // No pruning here: the document reference will commit in the same React event.
    return true;
  };

  discard = (assetId: string) => {
    if (!this.entries.get(assetId)?.pending) return;
    this.release(assetId);
    this.notify();
  };

  reconcile = (document: HamburgueriaPrototypeDocument) => {
    const used = getDocumentUploadIds(document);
    let changed = false;
    for (const [id, entry] of this.entries) if (!entry.pending && !used.has(id)) {
      this.release(id);
      changed = true;
    }
    if (changed) this.notify();
  };

  clear = () => {
    for (const id of this.entries.keys()) this.release(id);
    this.notify();
  };
}
