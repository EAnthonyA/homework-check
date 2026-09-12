import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserInfo } from "@/lib/google-oauth";
import { encrypt } from "@/lib/crypto";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import {
  upsertUser,
  getUserByGoogleSub,
  listUsers,
  updateRefreshToken,
  type Role,
} from "@/lib/repo";

function resolveRole(email: string): Role {
  const parents = (process.env.PARENT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (parents.includes(email.toLowerCase())) return "parent";
  // First signed-in user defaults to parent until PARENT_EMAILS is configured.
  if (listUsers().length === 0) return "parent";
  return "kid";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const savedState = store.get("oauth-state")?.value;
  store.delete("oauth-state");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=state", url.origin));
  }

  const origin = process.env.APP_URL ?? `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri);
    const info = await fetchUserInfo(tokens.access_token);
    const encrypted = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    const existing = getUserByGoogleSub(info.sub);
    let user;
    if (existing) {
      user = upsertUser({
        googleSub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture ?? null,
        role: existing.role,
      });
      if (encrypted) updateRefreshToken(user.id, encrypted);
    } else {
      user = upsertUser({
        googleSub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture ?? null,
        role: resolveRole(info.email),
        encryptedRefreshToken: encrypted,
      });
    }

    const token = await signSession({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
    });
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.redirect(new URL("/", url.origin));
  } catch (err) {
    console.error("[auth] callback error:", err);
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }
}
