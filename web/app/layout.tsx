import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

// Dirancang di Indonesia oleh Tokotype (PRD bagian 11).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "AgMon · Agni Monad",
  description:
    "Every satellite fire hotspot tied to its permit holder, recorded on Monad, with a fire bond released to restoration once field officers confirm.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.className}>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
