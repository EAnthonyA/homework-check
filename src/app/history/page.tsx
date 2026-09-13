import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { HistoryView } from "@/components/history-view";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") redirect("/kid");
  return <HistoryView session={session} />;
}
