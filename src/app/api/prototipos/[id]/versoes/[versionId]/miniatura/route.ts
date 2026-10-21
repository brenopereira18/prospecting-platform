import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { prototypeThumbnailService } from "@/src/server/prototype-thumbnails/thumbnails";
import { createThumbnailHandlers } from "@/src/server/prototype-thumbnails/thumbnail-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const handlers = createThumbnailHandlers({
  getUser: getCurrentUser,
  getSessionToken: async () => (await cookies()).get("session")?.value,
  service: prototypeThumbnailService,
});
export const GET = handlers.GET;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const response = await handlers.POST(request, context);
  if (response.ok) revalidatePath("/prototipos");
  return response;
}
