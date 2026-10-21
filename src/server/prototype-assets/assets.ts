import "server-only";
import { prisma } from "@/lib/prisma/client";
import { getR2Storage } from "../storage/r2";
import { PrototypeAssetService } from "./asset.service";

export const prototypeAssetService = new PrototypeAssetService(prisma, {
  put: (...args) => getR2Storage().put(...args),
  read: (...args) => getR2Storage().read(...args),
  remove: (...args) => getR2Storage().remove(...args),
});
