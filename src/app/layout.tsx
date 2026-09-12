import type { Metadata } from "next";
import { Roboto, Fredoka } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { resolveLocale } from "@/i18n";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Namų darbai",
  description: "Visi namų darbai vienoje vietoje",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("lang")?.value);

  return (
    <html lang={locale} className={`${roboto.variable} ${fredoka.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers locale={locale}>
          <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
