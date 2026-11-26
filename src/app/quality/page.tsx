import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { QualityView } from "@/components/quality-view";

export default async function QualityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "parent") redirect("/kid");
  return <QualityView session={session} />;
}
