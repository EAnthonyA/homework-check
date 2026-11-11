import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const karla = localFont({
  src: "./fonts/karla.ttf",
  variable: "--font-karla",
  weight: "200 800",
  display: "swap",
});

const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces.ttf", weight: "100 900", style: "normal" },
    { path: "./fonts/fraunces-italic.ttf", weight: "100 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const caveat = localFont({
  src: "./fonts/caveat.ttf",
  variable: "--font-caveat",
  weight: "400 700",
  display: "swap",
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
