import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  REMEMBERED_SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/auth";
import { authenticateUser } from "../../../../lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = readFormString(formData.get("username"));
  const password = readFormString(formData.get("password"));
  const remember = formData.get("remember") === "on";
  const nextPath = readSafeNextPath(readFormString(formData.get("next")));

  try {
    const user = await authenticateUser(username, password);

    if (!user) {
      return redirectToLogin("invalid", nextPath);
    }

    const maxAge = remember
      ? REMEMBERED_SESSION_MAX_AGE_SECONDS
      : SESSION_MAX_AGE_SECONDS;
    const token = await createSessionToken(user, maxAge);
    const response = createRedirectResponse(nextPath);

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return redirectToLogin("server", nextPath);
  }
}

function redirectToLogin(error: string, nextPath: string) {
  const loginUrl = new URL("/login", "http://local.request");

  loginUrl.searchParams.set("error", error);

  if (nextPath !== "/dashboard") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return createRedirectResponse(`${loginUrl.pathname}${loginUrl.search}`);
}

function createRedirectResponse(path: string) {
  return new NextResponse(null, {
    headers: {
      Location: path,
    },
    status: 303,
  });
}

function readFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readSafeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
