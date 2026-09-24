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

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

// --- Browser fingerprint ----------------------------------------------------
// Defaults mimic a current macOS Chrome. Override any of these via env vars if
// you want the scraper to present your exact browser fingerprint.

const USER_AGENT =
  env("HOMEWORK_SOURCE_USER_AGENT") ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const ACCEPT_LANGUAGE =
  env("HOMEWORK_SOURCE_ACCEPT_LANGUAGE") || "lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7";

const SEC_CH_UA =
  env("HOMEWORK_SOURCE_SEC_CH_UA") ||
  '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"';

const SEC_CH_UA_PLATFORM = env("HOMEWORK_SOURCE_PLATFORM") || '"macOS"';

const ACCEPT_HTML =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

function clientHintHeaders(): Record<string, string> {
  return {
    "sec-ch-ua": SEC_CH_UA,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": SEC_CH_UA_PLATFORM,
  };
}

/** Headers for a normal browser page navigation (GET). */
function navHeaders(site: "none" | "same-origin"): Record<string, string> {
  return {
    "user-agent": USER_AGENT,
    accept: ACCEPT_HTML,
    "accept-language": ACCEPT_LANGUAGE,
    "upgrade-insecure-requests": "1",
    "cache-control": "max-age=0",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": site,
    "sec-fetch-user": "?1",
    ...clientHintHeaders(),
  };
}

/** Headers for the jQuery AJAX login POST (same-origin XHR). */
function ajaxHeaders(referer: string): Record<string, string> {
  return {
    "user-agent": USER_AGENT,
    accept: "*/*",
    "accept-language": ACCEPT_LANGUAGE,
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "x-requested-with": "XMLHttpRequest",
    origin: baseUrl(),
    referer,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    ...clientHintHeaders(),
  };
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
    headers: navHeaders("none"),
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
    headers: { ...ajaxHeaders(loginPage), cookie: jar.header() },
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
    headers: { ...navHeaders("same-origin"), cookie: jar.header() },
    redirect: "manual",
  });
  jar.update(follow);
}

async function fetchPage(jar: CookieJar, pathName: string, label: string): Promise<string> {
  const path = env(pathName);
  if (!path) throw new HomeworkSourceError(`${pathName} is not set`);
  const url = endpoint(path);
  const res = await fetch(url, {
    headers: { ...navHeaders("same-origin"), cookie: jar.header() },
    redirect: "manual",
  });
  jar.update(res);
  if (res.status >= 400) {
    throw new HomeworkSourceError(`${label} page returned HTTP ${res.status}`);
  }
  return res.text();
}

export function fetchHomeworkPage(jar: CookieJar): Promise<string> {
  return fetchPage(jar, "HOMEWORK_SOURCE_HOMEWORK_PAGE", "Homework");
}

export function isAssessmentsPageConfigured(): boolean {
  return Boolean(env("HOMEWORK_SOURCE_ASSESSMENTS_PAGE"));
}

export function fetchAssessmentsPage(jar: CookieJar): Promise<string> {
  return fetchPage(jar, "HOMEWORK_SOURCE_ASSESSMENTS_PAGE", "Assessments");
}
