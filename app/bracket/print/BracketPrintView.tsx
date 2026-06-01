"use client";
import { useEffect } from "react";
import type { Match, BracketPick } from "@/lib/types";
import {
  KNOCKOUT_ROUNDS, type KnockoutRound, nodesInRound,
  NODE_MATCH_NO, r32SlotLabels, orderedR32Matches, participantsOf,
} from "@/lib/services/bracket";
import { ROUND_CONFIG } from "@/lib/constants";
import Flag from "@/components/Flag";

interface Props {
  bracketPicks: BracketPick[];
  matches: Match[];
  userName: string;
  leagueName: string;
  generatedAt: string;
}

const ROUND_SHORT: Record<KnockoutRound, string> = {
  ROUND_OF_32:    "Ro32",
  ROUND_OF_16:    "Ro16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS:    "SF",
  FINAL:          "Final",
};

export default function BracketPrintView({
  bracketPicks, matches, userName, leagueName, generatedAt,
}: Props) {
  // Strip app chrome (header/footer) on this page — both screen and print.
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "bkt-chrome-strip";
    el.textContent = `
      body > header, body > footer, nav { display: none !important; }
      body > main { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // Auto-open print dialog after first paint.
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  const bracket: Record<string, string> = {};
  for (const bp of bracketPicks) bracket[bp.nodeId] = bp.team;

  const r32Slots = orderedR32Matches(matches);
  const filledCount = Object.keys(bracket).length;
  const champion = bracket["F-1"] ?? null;
  const genDate = new Date(generatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div id="bkt-print-root">

        {/* ── Floating print button (screen only) ───────────────────────── */}
        <button id="bkt-print-btn" onClick={() => window.print()}>
          Print / Save PDF →
        </button>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div id="bkt-print-header">
          <div id="bkt-print-brand">
            <span id="bkt-print-logo">Nutmeg</span>
            <span id="bkt-print-sub">World Cup 2026 · Knockout Bracket</span>
          </div>
          <div id="bkt-print-meta">
            <span>{leagueName} · {userName}</span>
            <span id="bkt-print-state">
              {champion ? `Champion: ${champion}` : `${filledCount} / 31 slots filled`}
            </span>
            <span>{genDate} · nutmeg.bet</span>
          </div>
        </div>

        {/* ── Bracket tree ──────────────────────────────────────────────── */}
        <div id="bkt-print-tree">
          {KNOCKOUT_ROUNDS.map((round, ri) => (
            <div key={round} style={{ display: "contents" }}>

              {/* Round column */}
              <div className="bp-col">
                <div className="bp-col-head">
                  <span className="bp-round-name">{ROUND_SHORT[round]}</span>
                  <span className="bp-round-pts">{ROUND_CONFIG[round].pointsValue} pt</span>
                </div>
                <div className="bp-col-body">
                  {nodesInRound(round).map(node => {
                    const [teamA, teamB] = participantsOf(node.id, bracket, r32Slots);
                    const labels = r32SlotLabels(node.id);
                    const picked = bracket[node.id] ?? null;
                    return (
                      <div key={node.id} className="bp-cell">
                        <PrintMatchCard
                          teamA={teamA}
                          teamB={teamB}
                          labelA={labels?.[0] ?? null}
                          labelB={labels?.[1] ?? null}
                          picked={picked}
                          matchNo={NODE_MATCH_NO[node.id]}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connector column (not after Final) */}
              {ri < KNOCKOUT_ROUNDS.length - 1 && (
                <div key={`conn-${round}`} className="bp-conn">
                  <div className="bp-conn-head" />
                  <div className="bp-conn-body">
                    {nodesInRound(KNOCKOUT_ROUNDS[ri + 1]).map(destNode => (
                      <div key={destNode.id} className="bp-conn-group">
                        <BracketElbow />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function PrintMatchCard({
  teamA, teamB, labelA, labelB, picked, matchNo,
}: {
  teamA: string | null;
  teamB: string | null;
  labelA: string | null;
  labelB: string | null;
  picked: string | null;
  matchNo: number | undefined;
}) {
  return (
    <div className="bp-match">
      {matchNo !== undefined && (
        <div className="bp-match-meta">M{matchNo}</div>
      )}
      <div className="bp-match-box">
        <PrintTeamRow team={teamA} label={labelA} isPicked={picked !== null && picked === teamA} />
        <div className="bp-divider" />
        <PrintTeamRow team={teamB} label={labelB} isPicked={picked !== null && picked === teamB} />
      </div>
    </div>
  );
}

function PrintTeamRow({
  team, label, isPicked,
}: {
  team: string | null;
  label: string | null;
  isPicked: boolean;
}) {
  return (
    <div className={`bp-team${isPicked ? " bp-team-picked" : ""}`}>
      {team ? (
        <>
          <Flag team={team} size={11} />
          <span className="bp-name">{team}</span>
          {isPicked && <span className="bp-check">✓</span>}
        </>
      ) : (
        <>
          <span className="bp-seed-dot" />
          <span className="bp-seed">{label ?? "TBD"}</span>
        </>
      )}
    </div>
  );
}

/** SVG bracket elbow connector — stretches to fill its container via preserveAspectRatio="none". */
function BracketElbow() {
  const stroke = "#CBBFA8";
  const sw = "0.9";
  return (
    <svg
      viewBox="0 0 10 100"
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      {/* Top feeder: left → right → down to mid */}
      <path d={`M0,25 L7,25 L7,50`}  fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {/* Bottom feeder: left → right → up to mid */}
      <path d={`M0,75 L7,75 L7,50`}  fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {/* Output bar from midpoint to right edge */}
      <line x1="7" y1="50" x2="10" y2="50" stroke={stroke} strokeWidth={sw} />
    </svg>
  );
}

/* ─── Print CSS ──────────────────────────────────────────────────────────── */

const PRINT_CSS = `
  @page { size: landscape; margin: 7mm; }
  *, *::before, *::after { box-sizing: border-box; }

  /* ── Root container ── */
  #bkt-print-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: white;
    font-family: Georgia, 'Times New Roman', serif;
  }

  /* ── Screen-only floating button ── */
  #bkt-print-btn {
    position: fixed;
    top: 14px;
    right: 16px;
    z-index: 999;
    background: #0B1426;
    color: #F5F1E8;
    border: none;
    border-radius: 8px;
    padding: 9px 20px;
    font-family: monospace;
    font-size: 13px;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.15s;
  }
  #bkt-print-btn:hover { background: #C9302C; }

  /* ── Page header ── */
  #bkt-print-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 0 2px 6px;
    border-bottom: 1.5px solid #0B1426;
    margin-bottom: 5px;
  }
  #bkt-print-brand { display: flex; align-items: baseline; gap: 9px; }
  #bkt-print-logo {
    font-family: Georgia, serif;
    font-style: italic;
    font-weight: 700;
    font-size: 17px;
    color: #0B1426;
    line-height: 1;
  }
  #bkt-print-sub {
    font-family: monospace;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #8089A0;
  }
  #bkt-print-meta {
    display: flex;
    gap: 14px;
    font-family: monospace;
    font-size: 8px;
    color: #475065;
  }
  #bkt-print-state { color: #0B1426; font-weight: bold; }

  /* ── Tree layout ── */
  #bkt-print-tree {
    display: flex;
    align-items: stretch;
    flex: 1 1 0;
    min-height: 0;
  }

  /* ── Round columns ── */
  .bp-col {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
  }
  .bp-col-head {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 20px;
    flex-shrink: 0;
    padding: 0 3px;
    border-bottom: 1px solid #E0DACA;
  }
  .bp-round-name {
    font-family: monospace;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #0B1426;
  }
  .bp-round-pts {
    font-family: monospace;
    font-size: 7px;
    color: #8089A0;
  }
  .bp-col-body {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
  }
  .bp-cell {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px 0;
    min-height: 0;
  }

  /* ── Match cards ── */
  .bp-match { width: 100%; padding: 0 2px; }
  .bp-match-meta {
    height: 9px;
    font-family: monospace;
    font-size: 6.5px;
    color: #8089A0;
    padding: 0 3px;
    overflow: hidden;
    white-space: nowrap;
  }
  .bp-match-box {
    border: 1px solid #D8D2C4;
    border-radius: 4px;
    overflow: hidden;
    background: white;
  }
  .bp-divider { height: 1px; background: #E8E2D8; }

  /* ── Team rows ── */
  .bp-team {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2.5px 4px;
    min-height: 15px;
  }
  .bp-team-picked { background: rgba(27,94,32,0.07); }
  .bp-name {
    flex: 1;
    font-size: 8.5px;
    color: #0B1426;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  .bp-team-picked .bp-name { font-weight: 700; color: #1B5E20; }
  .bp-check { font-size: 7px; color: #1B5E20; flex-shrink: 0; }
  .bp-seed {
    flex: 1;
    font-family: monospace;
    font-size: 7.5px;
    color: #8089A0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  .bp-seed-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #F0EDE4;
    border: 1px solid #E0DACA;
    flex-shrink: 0;
  }

  /* ── Connector columns ── */
  .bp-conn {
    display: flex;
    flex-direction: column;
    flex: 0 0 14px;
  }
  .bp-conn-head { flex: 0 0 20px; }  /* aligns with .bp-col-head */
  .bp-conn-body {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
  }
  .bp-conn-group { flex: 1 1 0; }

  /* ── Print overrides ── */
  @media print {
    #bkt-print-btn { display: none !important; }
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;
