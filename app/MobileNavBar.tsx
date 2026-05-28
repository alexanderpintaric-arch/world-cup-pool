"use client";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Standings",
    exact: true,
    icon: (active: boolean) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <rect x="2"  y="10" width="4" height="8" rx="1"
          fill="currentColor" opacity={active ? 1 : 0.4}/>
        <rect x="8"  y="6"  width="4" height="12" rx="1"
          fill="currentColor" opacity={active ? 1 : 0.7}/>
        <rect x="14" y="8"  width="4" height="10" rx="1"
          fill="currentColor" opacity={active ? 1 : 0.4}/>
      </svg>
    ),
  },
  {
    href: "/picks",
    label: "My Picks",
    exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <rect x="4" y="3" width="12" height="14" rx="1.5"
          stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <path d="M7 10l2 2 4-4"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="7" y="2" width="6" height="2.5" rx="1"
          fill="currentColor" opacity={active ? 1 : 0.6}/>
      </svg>
    ),
  },
  {
    href: "/summary",
    label: "Summary",
    exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2"
          stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <path d="M6.5 7h7M6.5 10h7M6.5 13h4"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={active ? 1 : 0.6}/>
      </svg>
    ),
  },
  {
    href: "/community",
    label: "The Pool",
    exact: false,
    icon: (active: boolean) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <circle cx="7.5" cy="7" r="2.5"
          stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <circle cx="13" cy="6.5" r="2"
          stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.4}/>
        <path d="M2 16c0-3 2.5-4.5 5.5-4.5S13 13 13 16"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 12c1.5 0 4 1 4 4"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={active ? 1 : 0.4}/>
      </svg>
    ),
  },
];

export default function MobileNavBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  function isActive(tab: typeof TABS[number]) {
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line">
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <a
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              style={{ color: active ? "var(--color-accent)" : "var(--color-ink-faint)" }}
            >
              {tab.icon(active)}
              <span
                className="text-[10px] tracking-wide transition-all"
                style={{ fontWeight: active ? 600 : 500 }}
              >
                {tab.label}
              </span>
            </a>
          );
        })}

        {isAdmin && (
          <a
            href="/admin"
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ color: pathname.startsWith("/admin") ? "var(--color-accent)" : "var(--color-ink-faint)" }}
          >
            {/* Gear icon */}
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                opacity={pathname.startsWith("/admin") ? 1 : 0.6}
              />
            </svg>
            <span
              className="text-[10px] tracking-wide"
              style={{ fontWeight: pathname.startsWith("/admin") ? 600 : 500 }}
            >
              Admin
            </span>
          </a>
        )}
      </div>
    </nav>
  );
}
