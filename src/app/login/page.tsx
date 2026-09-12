import { LoginView } from "@/components/login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : undefined;
  return <LoginView error={error} />;
}
