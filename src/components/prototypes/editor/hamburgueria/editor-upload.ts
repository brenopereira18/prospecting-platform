import { z } from "zod";
import type { HamburgueriaPrototypeDocument as Document } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import {
  getHamburgueriaImageReferences,
  replaceUploadReferences,
} from "../../templates/hamburgueria/lib/image-references";
import type { ResolvedUploadImages } from "../../templates/hamburgueria/lib/images";
import { persistablePrototypeDocumentSchema } from "../../schemas/persistable-document.schema";

const uploadedAssetSchema = z.object({
  id: z.uuid(),
  prototypeId: z.uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
type UploadedAsset = z.infer<typeof uploadedAssetSchema>;

export async function uploadPrototypeImage(
  prototypeId: string,
  file: File,
): Promise<UploadedAsset> {
  const body = new FormData();
  body.set("file", file);
  let response: Response;
  try {
    response = await fetch(`/api/prototipos/${prototypeId}/assets`, {
      method: "POST",
      body,
      credentials: "same-origin",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error(
      "Não foi possível confirmar o envio da imagem. Verifique sua conexão.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "O servidor não confirmou o envio da imagem. Tente novamente.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Não foi possível enviar a imagem. Tente novamente.",
    );
  const asset = uploadedAssetSchema.parse(data.asset);
  if (asset.prototypeId !== prototypeId)
    throw new Error("A imagem recebida não pertence a este protótipo.");
  return asset;
}

/** Resource cache, not document state. Successful uploads survive failed saves until unmount. */
export class EditorImageUploads {
  private completed = new Map<string, UploadedAsset>();
  constructor(
    private prototypeId: string,
    private upload = uploadPrototypeImage,
  ) {}

  getResolvedUploads(): ResolvedUploadImages {
    return Object.fromEntries(
      [...this.completed.values()].map((asset) => [
        asset.id,
        {
          src: `/api/prototipos/${this.prototypeId}/assets/${asset.id}`,
          width: asset.width,
          height: asset.height,
        },
      ]),
    );
  }

  async prepare(
    document: Document,
    getFile: (id: string) => File | undefined,
    onProgress: (done: number, total: number) => void = () => {},
  ) {
    const ids = [
      ...new Set(
        getHamburgueriaImageReferences(document).flatMap(({ image }) =>
          image?.source === "upload" &&
          !z.uuid().safeParse(image.assetId).success
            ? [image.assetId]
            : [],
        ),
      ),
    ];
    // Retain actual File objects before awaiting: edits may revoke preview URLs meanwhile.
    const files = new Map(ids.map((id) => [id, getFile(id)]));
    for (const id of ids)
      if (!this.completed.has(id) && !files.get(id))
        throw new Error(
          "Uma imagem temporária não está disponível. Selecione o arquivo novamente antes de salvar.",
        );
    const replacements: Record<string, string> = {};
    for (const [index, id] of ids.entries()) {
      onProgress(index, ids.length);
      let asset = this.completed.get(id);
      if (!asset) {
        asset = uploadedAssetSchema.parse(
          await this.upload(this.prototypeId, files.get(id)!),
        );
        if (asset.prototypeId !== this.prototypeId)
          throw new Error("A imagem recebida não pertence a este protótipo.");
        this.completed.set(id, asset);
      }
      replacements[id] = asset.id;
    }
    const resolved = replaceUploadReferences(document, replacements);
    persistablePrototypeDocumentSchema.parse(resolved);
    return { document: resolved, replacements };
  }
}
