// Google Calendar sync: creates/updates all-day homework events on each user's
// own calendar (idempotent via the calendar_events table).
import { google } from "googleapis";
import { decrypt } from "./crypto";
import { addDays, vilniusDateString } from "./timezone";
import {
  getUserById,
  getHomeworkById,
  listUsers,
  getCalendarEvent,
  upsertCalendarEvent,
  deleteCalendarEvent,
  type HomeworkRow,
} from "./repo";

// Calendar requests can overlap with a parent reopening a just-completed item.
// Serialize per user, then read current DB status before sending each request.
const calendarQueues = new Map<string, Promise<unknown>>();
async function withCalendarLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = calendarQueues.get(userId) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(work);
  calendarQueues.set(userId, pending);
  try {
    return await pending;
  } finally {
    if (calendarQueues.get(userId) === pending) calendarQueues.delete(userId);
  }
}

function oauthForUser(encryptedRefreshToken: string) {
  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth.setCredentials({ refresh_token: decrypt(encryptedRefreshToken) });
  return oauth;
}

// The day the homework was assigned ("Įvesta" column), falling back to the day
// it first appeared in the DB. Pinned to Europe/Vilnius and clamped so it never
// starts after the deadline.
function assignedDate(item: HomeworkRow): string {
  const start = item.assigned_date ?? (item.created_at ? vilniusDateString(new Date(item.created_at)) : null);
  if (!start) return item.due_date;
  return start < item.due_date ? start : item.due_date;
}

export async function syncCalendarForUser(
  userId: string,
  items: HomeworkRow[],
): Promise<{ created: number; failed: number }> {
  return withCalendarLock(userId, () => syncCalendarForUserUnlocked(userId, items));
}

async function syncCalendarForUserUnlocked(
  userId: string,
  items: HomeworkRow[],
): Promise<{ created: number; failed: number }> {
  const user = getUserById(userId);
  if (!user || !user.calendar_enabled || !user.encrypted_refresh_token) {
    return { created: 0, failed: 0 };
  }

  let calendar;
  try {
    calendar = google.calendar({ version: "v3", auth: oauthForUser(user.encrypted_refresh_token) });
  } catch (error) {
    console.error(`[calendar] could not authenticate user=${userId}:`, error);
    return { created: 0, failed: items.length };
  }
  let created = 0;
  let failed = 0;

  for (const requested of items) {
    const item = getHomeworkById(requested.id);
    if (!item || item.done_at) continue;
    const startDate = assignedDate(item);
    const endDate = addDays(item.due_date, 1);
    const requestBody = {
      summary: item.subject,
      description: item.description,
      start: { date: startDate },
      end: { date: endDate },
    };

    try {
      const existing = getCalendarEvent(userId, item.id);
      if (existing) {
        // Already synced — update in place if the dates/subject drifted.
        try {
          const current = await calendar.events.get({
            calendarId: "primary",
            eventId: existing.google_event_id,
          });
          const ev = current.data;
          if (ev.status === "cancelled") throw Object.assign(new Error("Event was deleted"), { code: 410 });
          if (ev.start?.date !== startDate || ev.end?.date !== endDate || ev.summary !== item.subject) {
            await calendar.events.patch({
              calendarId: "primary",
              eventId: existing.google_event_id,
              requestBody,
            });
            console.log(`[calendar] updated event for user=${userId} item=${item.id} (${startDate}..${endDate})`);
          }
        } catch (err) {
          // The event was deleted on Google's side — recreate it.
          if ([404, 410].includes((err as { code: number }).code)) {
            deleteCalendarEvent(userId, item.id);
            const res = await calendar.events.insert({ calendarId: "primary", requestBody });
            if (res.data.id) {
              upsertCalendarEvent(userId, item.id, res.data.id);
              created += 1;
            }
          } else {
            throw err;
          }
        }
      } else {
        const res = await calendar.events.insert({ calendarId: "primary", requestBody });
        if (res.data.id) {
          upsertCalendarEvent(userId, item.id, res.data.id);
          created += 1;
        }
      }
    } catch (err) {
      failed += 1;
      console.error(`[calendar] failed to sync event for user=${userId} item=${item.id}:`, err);
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

// Deletes a homework item's calendar events from every user's calendar.
export async function removeHomeworkFromCalendars(
  homeworkId: string,
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const user of listUsers()) {
    if (!user.calendar_enabled || !user.encrypted_refresh_token) continue;

    await withCalendarLock(user.id, async () => {
      if (!getHomeworkById(homeworkId)?.done_at) return;
      const existing = getCalendarEvent(user.id, homeworkId);
      if (!existing) return;
      try {
        const calendar = google.calendar({ version: "v3", auth: oauthForUser(user.encrypted_refresh_token!) });
        await calendar.events.delete({ calendarId: "primary", eventId: existing.google_event_id });
        deleteCalendarEvent(user.id, homeworkId);
        deleted += 1;
      } catch (err) {
        const code = (err as { code?: number }).code;
        if (code === 404 || code === 410) {
          deleteCalendarEvent(user.id, homeworkId);
          deleted += 1;
        } else {
          failed += 1;
          console.error(`[calendar] failed to delete event for user=${user.id} item=${homeworkId}:`, err);
        }
      }
    });
  }
  return { deleted, failed };
}
