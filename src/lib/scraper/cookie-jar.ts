// Minimal cookie jar for the scraper, based on the Fetch API's Set-Cookie headers.
export class CookieJar {
  private cookies = new Map<string, string>();

  update(res: Response): void {
    const setCookies: string[] = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) {
      const single = res.headers.get("set-cookie");
      if (single) setCookies.push(single);
    }
    for (const setCookie of setCookies) {
      const first = setCookie.split(";")[0];
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      if (value === "" || value.toLowerCase() === "deleted") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
