import "server-only";
import { prisma } from "@/lib/prisma/client";
import { getR2Storage } from "../storage/r2";
import { PrototypeThumbnailService } from "./thumbnail.service";
import { captureThumbnail } from "./capture-thumbnail";

export const prototypeThumbnailService = new PrototypeThumbnailService(
  prisma,
  {
    put: (...args) => getR2Storage().put(...args),
    read: (...args) => getR2Storage().read(...args),
    remove: (...args) => getR2Storage().remove(...args),
  },
  captureThumbnail,
);
