import * as cheerio from "cheerio";

export interface ParsedMessageListItem {
  sourceId: string;
  unread: boolean;
}

export interface ParsedMessageDetail {
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  attachments: Array<{ name: string; sourcePath: string }>;
}

// Historical source-read messages must not appear as new in a newly created
// local inbox. Once we have a local copy, we may still refresh its metadata.
export function shouldImportMessage(item: ParsedMessageListItem, hasLocalCopy: boolean): boolean {
  return item.unread || hasLocalCopy;
}

function cleanText(el: { text: () => string }): string {
  return el.text().replace(/\s+/g, " ").trim();
}

function messageId(path: string | undefined): string | null {
  const match = path?.match(/\/message\/(\d+)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

export function parseMessageList(html: string): { items: ParsedMessageListItem[]; nextPagePath?: string } {
  const $ = cheerio.load(html);
  const items: ParsedMessageListItem[] = [];
  $("table.messageListTable tr[data-url]").each((_, row) => {
    const sourceId = messageId($(row).attr("data-url"));
    if (!sourceId) return;
    items.push({ sourceId, unread: $(row).hasClass("unreadMessageEnvelope") });
  });
  const seen = new Set<string>();
  const nextPagePath = $("a.pag-next").first().attr("href");
  return {
    items: items.filter((item) => !seen.has(item.sourceId) && Boolean(seen.add(item.sourceId))),
    nextPagePath: nextPagePath?.startsWith("/1/lt/page/message_new/message_list/") ? nextPagePath : undefined,
  };
}

export function parseMessageDetail(html: string, sourceId: string): ParsedMessageDetail | null {
  const $ = cheerio.load(html);
  const container = $(`#messageContainer-${sourceId}`).first();
  const sender = cleanText(container.find(".messageInboxSenderLabel").first());
  const subject = cleanText($("h3.subTitle").first());
  const bodyElement = container.find(".messageText").first();
  bodyElement.find("br").replaceWith(" ");
  bodyElement.find("p, div, li").each((_, element) => {
    $(element).append(" ");
  });
  const body = cleanText(bodyElement);
  const receivedAt = cleanText(container.find(".messageInboxDateLabel").first());
  if (!sender || !subject || !body || !/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(receivedAt)) return null;

  const attachments: ParsedMessageDetail["attachments"] = [];
  container.find(".messageFilesContainer a[href]").each((_, link) => {
    const sourcePath = $(link).attr("href");
    const name = $(link).attr("title") ?? cleanText($(link));
    if (sourcePath?.startsWith("/1/lt/action/lostandfound/download_file/") && name) {
      attachments.push({ name, sourcePath });
    }
  });
  return { sender, subject, body, receivedAt, attachments };
}
