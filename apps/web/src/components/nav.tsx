"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui";

const tabs = [
  {
    href: "/discover",
    label: "Discover",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path d="m15 9-1.8 4.2L9 15l1.8-4.2L15 9Z" />
      </svg>
    ),
  },
  {
    href: "/concierge",
    label: "Concierge",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12Z" />
        <circle cx="9" cy="12" r="0.8" fill="currentColor" />
        <circle cx="12.5" cy="12" r="0.8" fill="currentColor" />
        <circle cx="16" cy="12" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/connect",
    label: "Connect",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="8" cy="8" r="3.2" />
        <circle cx="16.5" cy="9.5" r="2.6" />
        <path d="M3.5 19c.6-3 2.4-4.6 4.5-4.6s3.9 1.6 4.5 4.6M14 15.4c2.6.1 4.4 1.6 5 4" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6" />
      </svg>
    ),
  },
];

const cx = (...parts: Array<string | false>) => parts.filter(Boolean).join(" ");

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {/* desktop top bar */}
      <header className="sticky top-0 z-20 hidden border-b border-line-soft bg-paper/85 backdrop-blur-md md:block">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/discover">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cx(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive(t.href)
                    ? "bg-yale text-white"
                    : "text-ink-soft hover:bg-yale/5 hover:text-yale",
                )}
              >
                {t.icon}
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* mobile top bar — brand only; navigation lives in the tab bar */}
      <header className="sticky top-0 z-20 border-b border-line-soft bg-paper/85 backdrop-blur-md md:hidden">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
          <Link href="/discover" aria-label="Passport home">
            <Wordmark />
          </Link>
        </div>
      </header>

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line-soft bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-medium",
                isActive(t.href) ? "text-yale" : "text-ink-soft",
              )}
            >
              {isActive(t.href) && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-yale" />
              )}
              {t.icon}
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
