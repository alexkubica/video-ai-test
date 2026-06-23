import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionEmail, isAllowedEmail, unauthorizedJson } from "@/lib/auth-helpers";

const PUBLIC_PATHS = new Set(["/sign-in"]);

const authProxy = auth((request) => {
  const { nextUrl } = request;
  const { pathname, search } = nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const authorized = isAllowedEmail(getSessionEmail(request.auth));

  if (PUBLIC_PATHS.has(pathname)) {
    if (authorized) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (authorized) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedJson();
  }

  const signInUrl = new URL("/sign-in", request.url);
  const callbackUrl = `${pathname}${search}`;

  if (callbackUrl && callbackUrl !== "/") {
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return NextResponse.redirect(signInUrl);
});

export { authProxy as proxy };

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
