import { headers } from "next/headers";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, readSessionToken } from "./auth";

export class AuthenticationError extends Error {}
export class CsrfError extends Error {}

export async function requireApiSession() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (!session) {
    throw new AuthenticationError("Authentication required.");
  }

  return session;
}

export async function assertSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");

  if (!host) {
    return;
  }

  if (new URL(origin).host !== host) {
    throw new CsrfError("Invalid request origin.");
  }
}
