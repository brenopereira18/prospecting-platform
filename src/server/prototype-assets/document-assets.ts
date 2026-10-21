import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import type { HamburgueriaPrototypeDocument } from "../../components/prototypes/templates/hamburgueria/schema/hamburgueria.schema";
import { getHamburgueriaImageReferences } from "../../components/prototypes/templates/hamburgueria/lib/image-references";

/** Must run under the prototype lock when saving or creating a version. */
export async function validateDocumentAssets(
  db: Pick<Prisma.TransactionClient, "prototypeAsset">,
  document: HamburgueriaPrototypeDocument,
  prototypeId: string,
  userId: string,
) {
  const references = getHamburgueriaImageReferences(document).filter(
    ({ image }) => image?.source === "upload",
  );
  const ids = [
    ...new Set(
      references.flatMap(({ image }) =>
        image?.source === "upload" ? [image.assetId] : [],
      ),
    ),
  ];
  if (!ids.length) return [];
  const assets = await db.prototypeAsset.findMany({
    where: {
      id: { in: ids },
      userId,
      prototypeId,
      prototype: { userId },
      deletionRequestedAt: null,
      deletedAt: null,
    },
    select: { id: true, width: true, height: true },
  });
  const allowed = new Set(assets.map((asset) => asset.id));
  const issues = references.filter(
    ({ image }) => image?.source === "upload" && !allowed.has(image.assetId),
  );
  if (issues.length)
    throw new z.ZodError(
      issues.map(({ path }) => ({
        code: "custom",
        path: ["document", ...path],
        message:
          "Imagem ausente, excluída ou sem autorização para este protótipo.",
      })),
    );
  return assets;
}
