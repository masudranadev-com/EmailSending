import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, readSessionToken } from "./lib/auth";

const protectedPagePrefixes = [
  "/dashboard",
  "/campaign",
  "/campaigns",
  "/customer",
  "/template",
  "/settings",
];

const protectedApiPrefixes = [
  "/api/campaigns",
  "/api/contacts",
  "/api/customers",
  "/api/dashboard",
  "/api/settings",
  "/api/templates",
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/campaign/:path*",
    "/campaigns/:path*",
    "/customer/:path*",
    "/template/:path*",
    "/settings/:path*",
    "/api/campaigns/:path*",
    "/api/contacts/:path*",
    "/api/customers/:path*",
    "/api/dashboard/:path*",
    "/api/settings/:path*",
    "/api/templates/:path*",
  ],
};

function isProtectedPath(pathname: string) {
  return (
    protectedPagePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix)) ||
    protectedApiPrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))
  );
}

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
