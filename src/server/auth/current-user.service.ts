import { cookies } from "next/headers";
import { getSessionByToken } from "./session.service";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await getSessionByToken(sessionToken);

  if (!session) {
    return null;
  }

  return session.user;
}
