import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { KidView } from "@/components/kid-view";

export default async function KidPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <KidView session={session} />;
}
