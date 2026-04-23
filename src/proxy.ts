import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("Authentication required.", {
    headers: {
      "WWW-Authenticate": 'Basic realm="OpenRouter Video Studio"',
    },
    status: 401,
  });
}

function decodeCredentials(header: string) {
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      password: decoded.slice(separatorIndex + 1),
      username: decoded.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const username = process.env.APP_BASIC_AUTH_USERNAME;
  const password = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return unauthorizedResponse();
  }

  const credentials = decodeCredentials(authHeader);

  if (
    !credentials ||
    credentials.username !== username ||
    credentials.password !== password
  ) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
