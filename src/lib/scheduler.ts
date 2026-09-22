// Scheduled scraper + calendar sync (runs inside the Next.js server process).
import cron from "node-cron";
import { runScrape } from "./scraper/run";
import { syncAllUsers } from "./calendar";
import { listUnfinishedHomework } from "./repo";
import { purgeExpiredUploads } from "./uploads";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // `||` (not `??`) so an empty/whitespace env value falls back to the default;
  // an empty string otherwise reaches node-cron and crashes startup with
  // "pattern includes illegal characters".
  const expression = process.env.SCRAPE_CRON?.trim() || "0 15 * * *";

  const purgedOnStart = purgeExpiredUploads();
  if (purgedOnStart) console.log(`[scheduler] removed ${purgedOnStart} expired upload(s)`);

  cron.schedule(
    "10 * * * *",
    () => {
      const removed = purgeExpiredUploads();
      if (removed) console.log(`[scheduler] removed ${removed} expired upload(s)`);
    },
    { timezone: "Europe/Vilnius" },
  );

  cron.schedule(
    expression,
    async () => {
      console.log("[scheduler] running scrape at", new Date().toISOString());
      try {
        const result = await runScrape();
        const sync = await syncAllUsers(listUnfinishedHomework());
        console.log(
          `[scheduler] scrape done (+${result.itemsAdded} items, ~${result.itemsChanged} changed); ` +
            `calendar: +${sync.created} events`,
        );
      } catch (err) {
        console.error("[scheduler] scrape failed:", err);
      }
    },
    { timezone: "Europe/Vilnius" },
  );
  console.log(`[scheduler] started with cron "${expression}" (Europe/Vilnius)`);
}
