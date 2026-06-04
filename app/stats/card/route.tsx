import { ImageResponse } from "next/og";
import { flagCodeFor } from "@/lib/services/flags";

export const runtime = "edge";

/**
 * Shareable player scorecard — a "Nutmeg Wrapped" card (1080×1350 PNG, portrait
 * so it drops cleanly into a story / group chat). Rendered entirely from query
 * params so it's public and crawler-friendly — no auth, no DB. The /stats page
 * builds the URL from the player's live stats, so the card is always a faithful
 * snapshot of their dossier.
 *
 * Design language borrows the energy of a Spotify Wrapped card — saturated
 * gradient, grain, one giant hero number, a ranked top-stats list, and a bold
 * "personality" (their earned title) block — while keeping Nutmeg's Fraunces +
 * JetBrains Mono type and ink/cream/gold palette.
 *
 * Params: n=name t=supportedTeam r=rank z=leagueSize p=points a=accuracy
 *         s=streak ls=bestRun u=upsets ti=title tb=titleBlurb lg=league
 *         c=champion ca=champAlive(1|0|"")
 */

/** Fetch a real TTF from Google Fonts (the old-browser UA makes them serve
 *  truetype, which Satori can parse — woff2 it can't). Best-effort: on any
 *  failure we return null and the card falls back to the bundled font. */
async function loadFont(query: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${query}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:10.0) Gecko/20100101 Firefox/10.0" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name   = (q.get("n") || "A Contender").slice(0, 24);
  const team   = q.get("t") || "";
  const rank   = q.get("r") || "—";
  const size   = q.get("z") || "—";
  const points = q.get("p") || "0";
  const acc    = q.get("a") || "0";
  const streak = q.get("s") || "0";
  const best   = q.get("ls") || streak;
  const upsets = q.get("u") || "0";
  const title  = (q.get("ti") || "In the hunt").slice(0, 24);
  const blurb  = (q.get("tb") || "Still climbing the table.").slice(0, 80);
  const league = (q.get("lg") || "the pool").slice(0, 26);
  const champ  = q.get("c") || "";
  const champAlive = q.get("ca"); // "1" alive · "0" out · "" undecided

  const teamCode  = team ? flagCodeFor(team) : null;
  const champCode = champ ? flagCodeFor(champ) : null;
  const flagUrl = (code: string | null) => (code ? `https://flagcdn.com/h80/${code}.png` : null);

  const [frBlack, frItalic, mono] = await Promise.all([
    loadFont("Fraunces:wght@900"),
    loadFont("Fraunces:ital,wght@1,600"),
    loadFont("JetBrains+Mono:wght@600"),
  ]);
  const fonts: { name: string; data: ArrayBuffer; weight: 600 | 900; style: "normal" }[] = [];
  if (frBlack)  fonts.push({ name: "Fraunces",   data: frBlack,  weight: 900, style: "normal" });
  if (frItalic) fonts.push({ name: "FrauncesIt", data: frItalic, weight: 600, style: "normal" });
  if (mono)     fonts.push({ name: "Mono",       data: mono,     weight: 600, style: "normal" });

  const has  = (n: string) => fonts.some((f) => f.name === n);
  const DISP = has("Fraunces")   ? "Fraunces"   : "Georgia, serif";   // heavy display numbers
  const ITAL = has("FrauncesIt") ? "FrauncesIt" : "Georgia, serif";   // italic editorial
  const MONO = has("Mono")       ? "Mono"       : "monospace";        // labels

  // palette
  const CREAM = "#F5F1E8", GOLD = "#F0C04A", INK = "#0B1426", ACCENT = "#C9302C";
  const c70 = "rgba(245,241,232,0.70)", c45 = "rgba(245,241,232,0.45)", c12 = "rgba(245,241,232,0.12)";

  type Row = { i: string; label: string; value: string; flag?: string | null; tag?: string; tagColor?: string };
  const rows: Row[] = [
    { i: "01", label: "Accuracy",      value: `${acc}%` },
    { i: "02", label: "Best run",      value: best === "1" ? "1 pick" : `${best} straight` },
    { i: "03", label: "Upsets called", value: `${upsets}` },
  ];
  if (champ) {
    rows.push({
      i: "04", label: "Pick to win", value: champ, flag: flagUrl(champCode),
      tag: champAlive === "0" ? "OUT" : champAlive === "1" ? "ALIVE" : undefined,
      tagColor: champAlive === "0" ? "#E8625B" : "#86C166",
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080, height: 1350, display: "flex", flexDirection: "column",
          position: "relative", padding: "72px 78px", fontFamily: ITAL,
          background: "linear-gradient(158deg, #E8443D 0%, #C9302C 28%, #5E1718 64%, #0B1426 100%)",
        }}
      >
        {/* ── atmosphere ── */}
        <div style={{ position: "absolute", top: -170, right: -130, width: 580, height: 580, borderRadius: "50%", display: "flex", background: "radial-gradient(circle, rgba(240,192,74,0.42) 0%, rgba(240,192,74,0) 66%)" }} />
        <div style={{ position: "absolute", top: -120, right: -120, width: 430, height: 430, borderRadius: "50%", border: `1px solid ${c12}`, display: "flex" }} />
        <div style={{ position: "absolute", top: -36, right: -36, width: 250, height: 250, borderRadius: "50%", border: "1px solid rgba(245,241,232,0.09)", display: "flex" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "radial-gradient(rgba(245,241,232,0.05) 1px, transparent 0)", backgroundSize: "5px 5px" }} />

        {/* ── masthead ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: ITAL, fontSize: 40, color: CREAM, letterSpacing: "-0.01em" }}>Nutmeg</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${c12}`, borderRadius: 999, padding: "9px 16px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "flex" }} />
            <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.26em", color: c70 }}>2026 WRAPPED</span>
          </div>
        </div>

        <div style={{ display: "flex", height: 1, background: c12, marginTop: 28 }} />

        {/* ── eyebrow ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34 }}>
          <div style={{ width: 30, height: 3, background: GOLD, borderRadius: 2, display: "flex" }} />
          <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.2em", color: c70, textTransform: "uppercase" }}>
            {league} · {ordinalShort(rank)} of {size}
          </span>
        </div>

        {/* ── name ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 22 }}>
          {flagUrl(teamCode) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flagUrl(teamCode)!} width={70} height={47} style={{ borderRadius: 6, objectFit: "cover" }} alt="" />
          )}
          <span style={{ fontFamily: ITAL, fontSize: 84, color: CREAM, lineHeight: 0.95, letterSpacing: "-0.02em", display: "flex" }}>
            {name}
          </span>
        </div>

        {/* ── hero number ── */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          <span style={{ fontFamily: DISP, fontWeight: 900, fontSize: 188, color: GOLD, lineHeight: 0.86, letterSpacing: "-0.04em", display: "flex" }}>
            {points}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.3em", color: c70, textTransform: "uppercase", marginTop: 14 }}>
            Points this tournament
          </span>
        </div>

        {/* ── ranked list ── */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          {rows.map((r) => (
            <div key={r.i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "19px 0", borderTop: `1px solid ${c12}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <span style={{ fontFamily: MONO, fontSize: 19, color: GOLD, letterSpacing: "0.04em" }}>{r.i}</span>
                <span style={{ fontFamily: ITAL, fontSize: 33, color: CREAM, display: "flex" }}>{r.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {r.flag && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.flag} width={44} height={30} style={{ borderRadius: 4, objectFit: "cover" }} alt="" />
                )}
                <span style={{ fontFamily: DISP, fontWeight: 900, fontSize: 36, color: CREAM, display: "flex" }}>{r.value}</span>
                {r.tag && (
                  <span style={{ fontFamily: MONO, fontSize: 13, color: r.tagColor, border: `1px solid ${r.tagColor}`, borderRadius: 999, padding: "4px 11px", letterSpacing: "0.14em", display: "flex" }}>
                    {r.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* push the title block + footer to the bottom */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* ── personality / earned title ── */}
        <div style={{ display: "flex", background: CREAM, borderRadius: 22, padding: "30px 34px", marginTop: 30 }}>
          <div style={{ width: 5, background: ACCENT, borderRadius: 3, display: "flex", marginRight: 26 }} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.24em", color: "rgba(11,20,38,0.55)", textTransform: "uppercase", display: "flex" }}>
              Their title
            </span>
            <span style={{ fontFamily: ITAL, fontSize: 50, color: INK, lineHeight: 1.0, letterSpacing: "-0.01em", marginTop: 12, display: "flex" }}>
              {title}
            </span>
            <span style={{ fontFamily: ITAL, fontSize: 22, color: "rgba(11,20,38,0.66)", lineHeight: 1.3, marginTop: 12, display: "flex" }}>
              {blurb}
            </span>
          </div>
        </div>

        {/* ── footer ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 30 }}>
          <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.12em", color: CREAM, display: "flex" }}>nutmeg.bet</span>
          <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", color: c45, textTransform: "uppercase", display: "flex" }}>
            The beautiful game, made personal
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: fonts.length ? fonts : undefined },
  );
}

function ordinalShort(r: string): string {
  const n = parseInt(r, 10);
  if (Number.isNaN(n)) return r;
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
