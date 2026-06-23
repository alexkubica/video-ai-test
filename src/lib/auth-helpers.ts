import { NextResponse } from "next/server";
import type { Session } from "next-auth";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function getAuthorizedEmail() {
  return normalizeEmail(process.env.AUTHORIZED_EMAIL);
}

export function isAllowedEmail(email?: string | null) {
  const allowedEmail = getAuthorizedEmail();

  if (!allowedEmail) {
    return false;
  }

  return normalizeEmail(email) === allowedEmail;
}

export function getSessionEmail(session: Session | null | undefined) {
  return normalizeEmail(session?.user?.email);
}

export function unauthorizedJson(message = "Unauthorized.") {
  return NextResponse.json({ error: message }, { status: 401 });
}
