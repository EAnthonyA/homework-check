import type { Metadata } from "next";
import { Roboto, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Namų darbai",
  description: "Visi namų darbai vienoje vietoje",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="lt" className={`${roboto.variable} ${nunito.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
