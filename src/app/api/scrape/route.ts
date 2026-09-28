import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runScrape } from "@/lib/scraper/run";
import { getLatestScrapeRun } from "@/lib/repo";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const run = getLatestScrapeRun();
  return NextResponse.json({ run: run ?? null });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "parent") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const startedAt = Date.now();
  console.log("[scrape API] manual refresh requested");
  try {
    const result = await runScrape();
    console.log(`[scrape API] manual refresh complete in ${Date.now() - startedAt}ms`);
    return NextResponse.json({
      ok: true,
      itemsAdded: result.itemsAdded,
      itemsChanged: result.itemsChanged,
      assessmentsAdded: result.assessmentsAdded,
      assessmentsChanged: result.assessmentsChanged,
      messagesAdded: result.messagesAdded,
      messagesChanged: result.messagesChanged,
    });
  } catch (err) {
    console.error(`[scrape API] manual refresh failed after ${Date.now() - startedAt}ms`);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
