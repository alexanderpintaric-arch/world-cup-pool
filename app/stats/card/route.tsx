import { ImageResponse } from "next/og";
import { flagCodeFor } from "@/lib/services/flags";

export const runtime = "edge";

/**
 * Shareable player scorecard (1200×630 PNG), rendered entirely from query params
 * so it's public and crawler-friendly — no auth, no DB. The /stats page builds
 * the URL from the player's live stats, so the card is always a faithful
 * snapshot of their dossier.
 *
 * Params: n=name t=supportedTeam r=rank z=leagueSize p=points a=accuracy
 *         s=streak ti=title(superlative) lg=league c=champion
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const name    = (q.get("n") || "A Contender").slice(0, 28);
  const team    = q.get("t") || "";
  const rank    = q.get("r") || "—";
  const size    = q.get("z") || "—";
  const points  = q.get("p") || "0";
  const acc     = q.get("a") || "0";
  const streak  = q.get("s") || "0";
  const title   = (q.get("ti") || "In the hunt").slice(0, 22);
  const league  = (q.get("lg") || "the pool").slice(0, 30);
  const champ   = q.get("c") || "";

  const teamCode  = team ? flagCodeFor(team) : null;
  const champCode = champ ? flagCodeFor(champ) : null;
  const flag = (code: string | null, h: number) =>
    code ? `https://flagcdn.com/h${h <= 40 ? 40 : 80}/${code}.png` : null;

  const INK = "#0B1426", PAPER = "#F5F1E8", ACCENT = "#C9302C", GOLD = "#A07820";
  const SERIF = 'Georgia, "Times New Roman", serif';
  const MONO = "monospace";

  const StatTile = ({ label, value, accentColor }: { label: string; value: string; accentColor?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <span style={{ fontSize: 64, fontWeight: 700, fontStyle: "italic", color: accentColor ?? INK, lineHeight: 1, fontFamily: SERIF }}>
        {value}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8089A0", marginTop: 10 }}>
        {label}
      </span>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", fontFamily: SERIF, background: PAPER }}>
        {/* ── Masthead ── */}
        <div style={{ height: 56, background: INK, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 56, paddingRight: 56, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontStyle: "italic", fontWeight: 700, fontSize: 22, color: PAPER }}>Nutmeg</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(245,241,232,0.4)" }}>
              World Cup 2026
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,241,232,0.4)" }}>
            {league}
          </span>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
          {/* ruled-paper texture */}
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 37px, rgba(11,20,38,0.035) 37px, rgba(11,20,38,0.035) 38px)" }} />
          {/* giant faded points watermark */}
          <div style={{ position: "absolute", right: -30, bottom: -90, fontSize: 420, fontStyle: "italic", fontWeight: 700, color: "rgba(11,20,38,0.05)", lineHeight: 1, letterSpacing: "-0.05em", display: "flex" }}>
            {points}
          </div>

          {/* ── Left column: identity + stats ── */}
          <div style={{ flex: "0 0 760px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "44px 50px 44px 56px", position: "relative" }}>
            {/* kicker */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 26, height: 3, background: ACCENT, borderRadius: 2 }} />
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8089A0" }}>
                Scorecard · {ordinalShort(rank)} of {size}
              </span>
            </div>

            {/* name + supported flag */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 30 }}>
              {flag(teamCode, 40) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={flag(teamCode, 40)!} width={62} height={42} style={{ borderRadius: 4, objectFit: "cover" }} alt="" />
              )}
              <span style={{ fontSize: 78, fontWeight: 700, fontStyle: "italic", color: INK, lineHeight: 0.9, letterSpacing: "-0.02em", display: "flex" }}>
                {name}
              </span>
            </div>

            {/* stat row */}
            <div style={{ display: "flex", gap: 12, paddingTop: 26, borderTop: `2px solid ${INK}` }}>
              <StatTile label="Points" value={points} accentColor={ACCENT} />
              <StatTile label="Accuracy" value={`${acc}%`} />
              {champ ? (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {flag(champCode, 40) && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={flag(champCode, 40)!} width={34} height={23} style={{ borderRadius: 3 }} alt="" />
                    )}
                    <span style={{ fontSize: 34, fontWeight: 700, fontStyle: "italic", color: GOLD, lineHeight: 1, display: "flex" }}>
                      {champ}
                    </span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8089A0", marginTop: 14 }}>
                    Pick to win
                  </span>
                </div>
              ) : (
                <StatTile label="Streak" value={streak} />
              )}
            </div>
          </div>

          {/* ── Right column: title "wax seal" on ink ── */}
          <div style={{ flex: 1, background: INK, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -110, right: -110, width: 380, height: 380, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", bottom: -120, left: -90, width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)" }} />

            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(245,241,232,0.45)", marginBottom: 26, display: "flex" }}>
              Their title
            </span>

            {/* seal */}
            <div style={{ width: 230, height: 230, borderRadius: "50%", background: "rgba(245,241,232,0.04)", border: `2px solid ${ACCENT}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <span style={{ fontSize: 40, fontWeight: 700, fontStyle: "italic", color: PAPER, textAlign: "center", lineHeight: 1.02, letterSpacing: "-0.01em", display: "flex" }}>
                {title}
              </span>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{ height: 46, background: INK, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 56, paddingRight: 56, flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: "rgba(245,241,232,0.85)" }}>
            nutmeg.bet
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,241,232,0.35)" }}>
            The beautiful game, made personal
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function ordinalShort(r: string): string {
  const n = parseInt(r, 10);
  if (Number.isNaN(n)) return r;
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
