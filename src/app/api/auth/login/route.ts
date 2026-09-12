import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.APP_URL ?? `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl({ redirectUri, state }));
}
