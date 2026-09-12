import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ParentDashboard } from "@/components/parent-dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ParentDashboard session={session} />;
}
