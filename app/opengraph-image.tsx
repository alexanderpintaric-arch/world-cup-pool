import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* ── TOP MASTHEAD BAR ────────────────────────────────────── */}
        <div
          style={{
            height: 48,
            background: "#0B1426",
            display: "flex",
            alignItems: "center",
            paddingLeft: 56,
            paddingRight: 56,
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#C9302C",
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "#F5F1E8",
              }}
            >
              Nutmeg
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(245,241,232,0.35)",
                marginLeft: 2,
              }}
            >
              · World Cup 2026 Pick&apos;em Pool
            </span>
          </div>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "rgba(245,241,232,0.3)",
            }}
          >
            nutmeg.bet
          </span>
        </div>

        {/* ── MAIN CONTENT ROW ────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex" }}>

          {/* ── LEFT: Cream paper panel ─────────────────────────── */}
          <div
            style={{
              flex: "0 0 790px",
              background: "#F5F1E8",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "48px 64px 48px 60px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Horizontal ruled-paper texture */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(11,20,38,0.035) 31px, rgba(11,20,38,0.035) 32px)",
              }}
            />

            {/* Faded "2026" watermark */}
            <div
              style={{
                position: "absolute",
                right: -40,
                bottom: -30,
                fontSize: 290,
                fontStyle: "italic",
                fontWeight: 700,
                color: "rgba(11,20,38,0.045)",
                lineHeight: 1,
                letterSpacing: "-0.05em",
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              2026
            </div>

            {/* Content layer */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Challenge headline */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginBottom: 30,
                }}
              >
                <span
                  style={{
                    fontSize: 140,
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#0B1426",
                    lineHeight: 0.87,
                    letterSpacing: "-0.03em",
                  }}
                >
                  Think you
                </span>
                <span
                  style={{
                    fontSize: 140,
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#C9302C",
                    lineHeight: 0.87,
                    letterSpacing: "-0.03em",
                  }}
                >
                  know
                </span>
                <span
                  style={{
                    fontSize: 140,
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#0B1426",
                    lineHeight: 0.87,
                    letterSpacing: "-0.03em",
                  }}
                >
                  football?
                </span>
              </div>

              {/* Stats subline */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 2,
                    background: "#C9302C",
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    color: "#8089A0",
                    textTransform: "uppercase",
                  }}
                >
                  48 matches · 8 rounds · your league awaits
                </span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Red challenge panel ───────────────────────── */}
          <div
            style={{
              flex: 1,
              background: "#C9302C",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Concentric ring decorations */}
            <div
              style={{
                position: "absolute",
                top: -90,
                right: -90,
                width: 340,
                height: 340,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: -140,
                right: -140,
                width: 460,
                height: 460,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -100,
                left: -80,
                width: 300,
                height: 300,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            />

            {/* Inner glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.08) 0%, transparent 70%)",
              }}
            />

            {/* Text content */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: 90,
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "white",
                  lineHeight: 0.82,
                  letterSpacing: "-0.03em",
                  textAlign: "center",
                }}
              >
                Prove
              </span>
              <span
                style={{
                  fontSize: 90,
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "white",
                  lineHeight: 0.82,
                  letterSpacing: "-0.03em",
                  textAlign: "center",
                }}
              >
                it.
              </span>

              {/* Divider */}
              <div
                style={{
                  width: 40,
                  height: 1,
                  background: "rgba(255,255,255,0.35)",
                  margin: "26px 0 22px",
                }}
              />

              {/* URL */}
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 17,
                  color: "rgba(255,255,255,0.95)",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                nutmeg.bet
              </span>

              {/* CTA */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.18)",
                  borderRadius: 4,
                  padding: "5px 14px",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.7)",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                  }}
                >
                  Join free
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── BOTTOM BAR ──────────────────────────────────────────── */}
        <div
          style={{
            height: 44,
            background: "#0B1426",
            display: "flex",
            alignItems: "center",
            paddingLeft: 60,
            paddingRight: 60,
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "rgba(245,241,232,0.4)",
              textTransform: "uppercase",
            }}
          >
            Canada · Mexico · United States
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "rgba(245,241,232,0.28)",
            }}
          >
            Jun 11 — Jul 19, 2026
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
