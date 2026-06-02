"use client";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";

const LINKS = [
  { href: "/",          label: "Standings" },
  { href: "/picks",     label: "My Picks" },
  { href: "/stats",     label: "My Stats" },
  { href: "/receipts",  label: "Receipts" },
  { href: "/community", label: "The Pool" },
];

// useLayoutEffect on the client, useEffect on the server (avoids SSR warning)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function DesktopNavLinks() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [bar, setBar] = useState<{ left: number; width: number; on: boolean }>({
    left: 0, width: 0, on: false,
  });

  const activeIndex = LINKS.findIndex(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  );

  const moveTo = useCallback((index: number) => {
    const el = linkRefs.current[index];
    const container = containerRef.current;
    if (!el || !container) { setBar(b => ({ ...b, on: false })); return; }
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setBar({ left: r.left - c.left, width: r.width, on: true });
  }, []);

  // Position under the active link on mount / route change / resize / font load
  useIsoLayoutEffect(() => {
    if (activeIndex < 0) { setBar(b => ({ ...b, on: false })); return; }
    moveTo(activeIndex);

    const ro = new ResizeObserver(() => moveTo(activeIndex));
    if (containerRef.current) ro.observe(containerRef.current);

    // Fonts can shift link widths after first paint — re-measure when ready
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => moveTo(activeIndex)).catch(() => {});

    return () => ro.disconnect();
  }, [activeIndex, pathname, moveTo]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onMouseLeave={() => (activeIndex >= 0 ? moveTo(activeIndex) : setBar(b => ({ ...b, on: false })))}
    >
      {LINKS.map(({ href, label }, i) => {
        const active = i === activeIndex;
        return (
          <a
            key={href}
            href={href}
            ref={el => { linkRefs.current[i] = el; }}
            onMouseEnter={() => moveTo(i)}
            aria-current={active ? "page" : undefined}
            className={`relative px-3.5 py-2 text-[13.5px] font-medium tracking-[-0.01em] transition-colors duration-200 whitespace-nowrap
              ${active ? "ink" : "ink-faint hover:ink"}`}
          >
            {label}
          </a>
        );
      })}

      {/* Sliding accent indicator */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-accent"
        style={{
          left: bar.left,
          width: bar.width,
          opacity: bar.on ? 1 : 0,
          transition: "left 0.32s cubic-bezier(0.22,1,0.36,1), width 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
        }}
      />
    </div>
  );
}
