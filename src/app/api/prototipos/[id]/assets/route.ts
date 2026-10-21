import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { prototypeAssetService } from "@/src/server/prototype-assets/assets";
import { createAssetHandlers } from "@/src/server/prototype-assets/asset-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createAssetHandlers({
  getUser: getCurrentUser,
  service: prototypeAssetService,
});
export const POST = handlers.upload;
export const GET = handlers.list;
