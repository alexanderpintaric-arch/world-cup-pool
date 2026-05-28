import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PLAYERS = [
  { rank: 1, name: "Alex",   pts: 142, gold: true  },
  { rank: 2, name: "Jamie",  pts: 138, gold: false },
  { rank: 3, name: "Sam",    pts: 131, gold: false },
  { rank: 4, name: "Taylor", pts: 124, gold: false },
  { rank: 5, name: "Chris",  pts: 118, gold: false },
];

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          background: "#0B1426",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Decorative background circles ───────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -100,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(201,48,44,0.09) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            right: 380,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(160,120,32,0.07) 0%, transparent 70%)",
          }}
        />

        {/* ── Accent stripe top ───────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #C9302C 0%, #E8570A 40%, transparent 100%)",
          }}
        />

        {/* ── LEFT: Branding ──────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px 64px 80px",
            flex: "0 0 560px",
          }}
        >
          {/* Pre-title badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#C9302C",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#8089A0",
              }}
            >
              World Cup 2026
            </span>
          </div>

          {/* Brand name */}
          <span
            style={{
              fontSize: 118,
              fontStyle: "italic",
              fontWeight: 500,
              color: "#F5F1E8",
              lineHeight: 0.92,
              letterSpacing: "-0.025em",
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            Nutmeg
          </span>

          {/* Accent underline */}
          <div
            style={{
              width: 190,
              height: 3,
              background: "#C9302C",
              marginTop: 22,
              marginBottom: 32,
              borderRadius: 2,
            }}
          />

          {/* Tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 24,
                color: "#C8C2B6",
                lineHeight: 1.45,
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontWeight: 300,
              }}
            >
              Pick every match. Climb your league.
            </span>
            <span
              style={{
                fontSize: 24,
                color: "#C8C2B6",
                lineHeight: 1.45,
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontWeight: 300,
              }}
            >
              Settle every argument.
            </span>
          </div>

          {/* CTA pill */}
          <div
            style={{
              marginTop: 44,
              display: "flex",
              alignItems: "center",
              gap: 0,
            }}
          >
            <div
              style={{
                background: "#C9302C",
                color: "white",
                padding: "13px 28px",
                borderRadius: 8,
                fontSize: 16,
                fontFamily: "monospace",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              Join free at nutmeg.bet
            </div>
          </div>
        </div>

        {/* ── Thin vertical divider ───────────────────────────────── */}
        <div
          style={{
            width: 1,
            background: "rgba(224,218,202,0.08)",
            margin: "56px 0",
          }}
        />

        {/* ── RIGHT: Leaderboard card ─────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 80px 64px 56px",
          }}
        >
          <div
            style={{
              background: "#FFFEFA",
              borderRadius: 18,
              padding: "28px 32px 24px",
              width: 360,
              display: "flex",
              flexDirection: "column",
              boxShadow:
                "0 2px 4px rgba(11,20,38,0.12), 0 20px 60px -20px rgba(11,20,38,0.5)",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#475065",
                  fontWeight: 600,
                }}
              >
                The Pub FC
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "#8089A0",
                  background: "#F5F1E8",
                  padding: "3px 8px",
                  borderRadius: 4,
                  letterSpacing: "0.08em",
                }}
              >
                Group Stage
              </span>
            </div>

            {/* Divider */}
            <div
              style={{ height: 1, background: "#E0DACA", marginBottom: 14 }}
            />

            {/* Rows */}
            {PLAYERS.map(({ rank, name, pts, gold }, i) => (
              <div
                key={rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "9px 0",
                  borderBottom:
                    i < PLAYERS.length - 1 ? "1px solid #F0EBE0" : "none",
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    width: 26,
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: gold ? "#A07820" : rank === 2 ? "#475065" : "#8089A0",
                    fontWeight: gold ? 700 : 400,
                  }}
                >
                  #{rank}
                </span>

                {/* Colored dot (team supporter) */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      rank === 1
                        ? "#1B7A3D"
                        : rank === 2
                          ? "#1E40AF"
                          : rank === 3
                            ? "#C9302C"
                            : rank === 4
                              ? "#A07820"
                              : "#8089A0",
                    marginRight: 10,
                    flexShrink: 0,
                  }}
                />

                {/* Name */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: "#0B1426",
                    fontFamily: "'Helvetica Neue', Arial, sans-serif",
                    fontWeight: gold ? 600 : 400,
                  }}
                >
                  {name}
                </span>

                {/* Points */}
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: "monospace",
                    color: gold ? "#A07820" : "#475065",
                    fontWeight: gold ? 700 : 400,
                  }}
                >
                  {pts}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#8089A0",
                    marginLeft: 4,
                  }}
                >
                  pts
                </span>
              </div>
            ))}

            {/* Footer */}
            <div
              style={{ height: 1, background: "#E0DACA", marginTop: 10, marginBottom: 10 }}
            />
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#8089A0",
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                }}
              >
                + 7 others competing
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
