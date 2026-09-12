// Google Calendar sync: creates/updates all-day homework events on each user's
// own calendar (idempotent via the calendar_events table).
import { google } from "googleapis";
import { decrypt } from "./crypto";
import { addDays } from "./timezone";
import {
  getUserById,
  listUsers,
  getCalendarEvent,
  upsertCalendarEvent,
  type HomeworkRow,
} from "./repo";

function oauthForUser(encryptedRefreshToken: string) {
  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth.setCredentials({ refresh_token: decrypt(encryptedRefreshToken) });
  return oauth;
}

export async function syncCalendarForUser(
  userId: string,
  items: HomeworkRow[],
): Promise<{ created: number; failed: number }> {
  const user = getUserById(userId);
  if (!user || !user.calendar_enabled || !user.encrypted_refresh_token) {
    return { created: 0, failed: 0 };
  }

  const calendar = google.calendar({ version: "v3", auth: oauthForUser(user.encrypted_refresh_token) });
  let created = 0;
  let failed = 0;

  for (const item of items) {
    if (getCalendarEvent(userId, item.id)) continue; // already synced
    try {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: item.subject,
          description: item.description,
          start: { date: item.due_date },
          end: { date: addDays(item.due_date, 1) },
        },
      });
      if (res.data.id) {
        upsertCalendarEvent(userId, item.id, res.data.id);
        created += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`[calendar] failed to create event for user=${userId} item=${item.id}:`, err);
    }
  }
  return { created, failed };
}

export async function syncAllUsers(items: HomeworkRow[]): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed = 0;
  for (const user of listUsers()) {
    const result = await syncCalendarForUser(user.id, items);
    created += result.created;
    failed += result.failed;
  }
  return { created, failed };
}
