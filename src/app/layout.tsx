import type { Metadata } from "next";
import { Caveat, Fraunces, Karla } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Namų darbai",
  description: "Šeimos namų darbų sąsiuvinis — viskas vienoje vietoje",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="lt" className={`${karla.variable} ${fraunces.variable} ${caveat.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
