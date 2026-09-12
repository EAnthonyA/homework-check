// HTTP client for the external homework source.
//
// All endpoints, field names and credentials come from environment variables so
// this repository does not name or reference the upstream service.
//
// Login flow (reverse-engineered from the source's public login page):
//   1. GET the login page — seeds the session cookie.
//   2. POST form-encoded credentials to the login endpoint (an AJAX endpoint
//      that returns JSON: `{ url, message?, doubleAuth? }`).
//   3. If `doubleAuth` is present the account has two-factor auth (unsupported).
//      If `url` is truthy it is the post-login redirect target.
//   4. Follow `url` to finalize the session, then GET the homework page.
import { CookieJar } from "./cookie-jar";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export class HomeworkSourceError extends Error {}

function baseUrl(): string {
  const base = env("HOMEWORK_SOURCE_BASE_URL").replace(/\/+$/, "");
  if (!base) throw new HomeworkSourceError("HOMEWORK_SOURCE_BASE_URL is not set");
  return base;
}

function endpoint(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl()}${p}`;
}

export async function login(jar: CookieJar): Promise<void> {
  const username = env("HOMEWORK_SOURCE_USERNAME");
  const password = env("HOMEWORK_SOURCE_PASSWORD");
  if (!username || !password) {
    throw new HomeworkSourceError("HOMEWORK_SOURCE_USERNAME and HOMEWORK_SOURCE_PASSWORD are not set");
  }

  const loginPage = endpoint(env("HOMEWORK_SOURCE_LOGIN_PAGE"));
  const loginAction = endpoint(env("HOMEWORK_SOURCE_LOGIN_ACTION"));

  // Seed any session cookie issued on first visit.
  const seed = await fetch(loginPage, {
    headers: { "user-agent": UA, "accept-language": "lt-LT,lt;q=0.9" },
    redirect: "manual",
  });
  jar.update(seed);

  const rememberField = env("HOMEWORK_SOURCE_REMEMBER_FIELD") || "remember_me";
  const submitValue = env("HOMEWORK_SOURCE_LOGIN_SUBMIT") || "Login";
  const body = new URLSearchParams({
    username,
    password,
    [rememberField]: "1",
    login_submit: submitValue,
  });

  const res = await fetch(loginAction, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      accept: "*/*",
      "user-agent": UA,
      "accept-language": "lt-LT,lt;q=0.9",
      referer: loginPage,
      cookie: jar.header(),
    },
    body: body.toString(),
    redirect: "manual",
  });
  jar.update(res);

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HomeworkSourceError(`Login returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  if (data.doubleAuth) {
    throw new HomeworkSourceError(
      "Two-factor authentication is enabled on the source account — the scraper does not support 2FA yet.",
    );
  }
  if (!data.url || data.url === false) {
    throw new HomeworkSourceError(`Login failed: ${String(data.message ?? "unknown error")}`);
  }

  // Follow the success redirect so the session is fully established.
  const target = String(data.url);
  const followUrl = target.startsWith("http") ? target : `${baseUrl()}${target}`;
  const follow = await fetch(followUrl, {
    headers: { "user-agent": UA, "accept-language": "lt-LT,lt;q=0.9", cookie: jar.header() },
    redirect: "manual",
  });
  jar.update(follow);
}

export async function fetchHomeworkPage(jar: CookieJar): Promise<string> {
  const url = endpoint(env("HOMEWORK_SOURCE_HOMEWORK_PAGE"));
  const res = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "lt-LT,lt;q=0.9", cookie: jar.header() },
    redirect: "manual",
  });
  jar.update(res);
  if (res.status >= 400) {
    throw new HomeworkSourceError(`Homework page returned HTTP ${res.status}`);
  }
  return res.text();
}
