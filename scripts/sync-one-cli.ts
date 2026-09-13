// One-off helper to verify calendar sync WITHOUT spamming every calendar:
//   pnpm exec tsx scripts/sync-one-cli.ts [email]        — sync ONE item
//   pnpm exec tsx scripts/sync-one-cli.ts --list [email] — list next 14 days
// Creates a single all-day event for the most recent homework item on ONE
// user's Google Calendar. Without an email argument it targets the first
// eligible user (calendar enabled + has a refresh token).
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {
  // .env is optional when env vars are already set.
}

import { google } from "googleapis";
import { decrypt } from "../src/lib/crypto";
import { syncCalendarForUser } from "../src/lib/calendar";
import { listUsers, listAllHomework, type UserRow } from "../src/lib/repo";

function findUser(users: UserRow[], email?: string): UserRow | undefined {
  if (email) return users.find((u) => u.email === email);
  return users.find((u) => u.calendar_enabled === 1 && u.encrypted_refresh_token);
}

async function listUpcoming(user: UserRow): Promise<void> {
  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth.setCredentials({ refresh_token: decrypt(user.encrypted_refresh_token!) });
  const calendar = google.calendar({ version: "v3", auth: oauth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  console.log(`\nCalendar "primary" -> ${res.data.summary} (timezone: ${res.data.timeZone})`);
  const events = res.data.items ?? [];
  if (events.length === 0) {
    console.log("No events in the next 14 days.");
    return;
  }
  for (const ev of events) {
    const when = ev.start?.date ?? ev.start?.dateTime ?? "?";
    console.log(`- ${when} | ${ev.summary}${ev.transparency === "transparent" ? " (free)" : ""}`);
  }
}

async function main() {
  const users = listUsers();
  console.log("Users:");
  for (const u of users) {
    console.log(
      `- ${u.email} | role=${u.role} | calendar_enabled=${u.calendar_enabled} | refresh_token=${u.encrypted_refresh_token ? "yes" : "no"}`,
    );
  }

  const argv = process.argv.slice(2);
  if (argv[0] === "--list") {
    const user = findUser(users, argv[1]);
    if (!user || !user.encrypted_refresh_token) {
      console.error("\nNo eligible user found. Pass an email argument or sign in with Google consent first.");
      process.exit(1);
    }
    await listUpcoming(user);
    return;
  }

  const homework = listAllHomework();
  console.log(`\nHomework items in DB: ${homework.length}`);
  if (homework.length === 0) {
    console.error("No homework in DB — run `pnpm scrape` first.");
    process.exit(1);
  }

  const user = findUser(users, argv[0]);
  if (!user) {
    console.error("\nNo eligible user found. Pass an email argument or sign in with Google consent first.");
    process.exit(1);
  }
  if (!user.encrypted_refresh_token) {
    console.error(`\nUser ${user.email} has no refresh token — sign in again (prompt=consent).`);
    process.exit(1);
  }

  const item = homework[homework.length - 1];
  console.log(`\nSyncing ONLY this item -> ${user.email}:`);
  console.log(`  ${item.due_date} | ${item.subject} | ${item.description}`);

  const result = await syncCalendarForUser(user.id, [item]);
  console.log(`\nDone: created=${result.created} failed=${result.failed}`);
  if (result.created === 0 && result.failed === 0) {
    console.log("Nothing created — item may already be synced (see calendar_events table).");
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
