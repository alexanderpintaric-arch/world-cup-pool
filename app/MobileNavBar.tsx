"use client";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  exact: boolean;
  icon: (active: boolean) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Standings",
    exact: true,
    icon: (active) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        <rect x="2"  y="10" width="4" height="8"  rx="1" fill="currentColor" opacity={active ? 1 : 0.4}/>
        <rect x="8"  y="6"  width="4" height="12" rx="1" fill="currentColor" opacity={active ? 1 : 0.7}/>
        <rect x="14" y="8"  width="4" height="10" rx="1" fill="currentColor" opacity={active ? 1 : 0.4}/>
      </svg>
    ),
  },
  {
    href: "/picks",
    label: "My Picks",
    exact: false,
    icon: (active) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="7" y="2" width="6" height="2.5" rx="1" fill="currentColor" opacity={active ? 1 : 0.6}/>
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    exact: false,
    icon: (active) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        <circle cx="10" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <path d="M10 6.2l.9 1.5 1.7.3-1.2 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.2-1.2 1.7-.3.8-1.5z" fill="currentColor" opacity={active ? 1 : 0.7}/>
        <path d="M7 12.5L6 18l4-2 4 2-1-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity={active ? 1 : 0.5}/>
      </svg>
    ),
  },
  {
    href: "/receipts",
    label: "Receipts",
    exact: false,
    icon: (active) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        <path d="M5 2.5h10a.5.5 0 01.5.5v14.2a.3.3 0 01-.46.25L13.5 16.4l-1.75 1.1L10 16.4l-1.75 1.1L6.5 16.4l-1.54.95A.3.3 0 014.5 17.1V3a.5.5 0 01.5-.5z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity={active ? 1 : 0.6}/>
        <path d="M7 6.5h6M7 9.5h6M7 12.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={active ? 1 : 0.6}/>
      </svg>
    ),
  },
  {
    href: "/community",
    label: "The Pool",
    exact: false,
    icon: (active) => (
      <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
        <circle cx="7.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.6}/>
        <circle cx="13" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.4}/>
        <path d="M2 16c0-3 2.5-4.5 5.5-4.5S13 13 13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 12c1.5 0 4 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={active ? 1 : 0.4}/>
      </svg>
    ),
  },
];

const ADMIN_TAB: Tab = {
  href: "/admin",
  label: "Admin",
  exact: false,
  icon: (active) => (
    <svg viewBox="0 0 20 20" fill="none" className="h-[22px] w-[22px]" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        opacity={active ? 1 : 0.6}
      />
    </svg>
  ),
};

export default function MobileNavBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  const isActive = (tab: Tab) => (tab.exact ? pathname === tab.href : pathname.startsWith(tab.href));
  const activeIndex = tabs.findIndex(isActive);
  const count = tabs.length;

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/90 backdrop-blur-xl border-t border-line"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Sliding active tick along the top edge */}
      <span
        aria-hidden="true"
        className="absolute top-0 h-[3px] w-8 rounded-full bg-accent"
        style={{
          left: `${((activeIndex + 0.5) / count) * 100}%`,
          transform: "translateX(-50%)",
          opacity: activeIndex >= 0 ? 1 : 0,
          transition: "left 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
        }}
      />

      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <a
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 select-none active:scale-95 transition-transform"
              style={{ color: active ? "var(--color-accent)" : "var(--color-ink-faint)" }}
            >
              <span
                className="relative flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: active ? "translateY(-1px) scale(1.06)" : "none" }}
              >
                {/* Soft halo behind the active icon */}
                <span
                  className="absolute inset-[-9px] rounded-full bg-accent/10 transition-opacity duration-200"
                  style={{ opacity: active ? 1 : 0 }}
                />
                <span className="relative">{tab.icon(active)}</span>
              </span>
              <span
                className="text-[10px] tracking-[0.02em] transition-all duration-200"
                style={{ fontWeight: active ? 600 : 500 }}
              >
                {tab.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
