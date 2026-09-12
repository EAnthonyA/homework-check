// Standalone scraper runner for debugging and manual runs:
//   pnpm scrape
// Logs in to the configured source, fetches the homework page, parses it and
// writes the results to the SQLite database. With SCRAPER_DEBUG=1 it also dumps
// the raw HTML to ./data/debug for selector tuning.
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {
  // .env is optional when env vars are already set.
}

import { runScrape } from "../src/lib/scraper/run";
import { listAllHomework } from "../src/lib/repo";

async function main() {
  const result = await runScrape();
  console.log(`Scrape done: +${result.itemsAdded} added, ~${result.itemsChanged} changed`);
  const all = listAllHomework();
  for (const item of all) {
    console.log(`- ${item.due_date} | ${item.subject} | ${item.description}`);
  }
  console.log(`Total homework items in DB: ${all.length}`);
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
