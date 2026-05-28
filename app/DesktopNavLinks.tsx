"use client";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",          label: "Standings" },
  { href: "/picks",     label: "My Picks" },
  { href: "/receipts",  label: "Receipts" },
  { href: "/community", label: "The Pool" },
];

export default function DesktopNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={`relative px-3 py-1.5 rounded-md text-[13.5px] font-medium transition-colors
              ${active
                ? "bg-ink text-paper"
                : "ink-soft hover:ink hover:bg-paper-deep"
              }`}
          >
            {label}
          </a>
        );
      })}
    </>
  );
}
