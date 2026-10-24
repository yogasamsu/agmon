"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, type Lang } from "@/lib/i18n";
import Logo from "./Logo";

export default function SiteHeader() {
  const { lang, t, setLang } = useLang();
  const path = usePathname();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <Logo />
        <div>
          <span className="brand-name">AgMon</span>
          <p>{t.tagline}</p>
        </div>
      </Link>
      <nav className="nav">
        <Link href="/" className={path === "/" ? "on" : ""}>
          {t.navHome}
        </Link>
        <Link href="/dashboard" className={path.startsWith("/dashboard") ? "on" : ""}>
          {t.navDashboard}
        </Link>
        <LangSwitch lang={lang} setLang={setLang} label={t.langLabel} />
      </nav>
    </header>
  );
}

function LangSwitch({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div className="lang" role="group" aria-label={label}>
      {(["en", "id"] as const).map((l) => (
        <button key={l} className={`lang-btn ${lang === l ? "on" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
