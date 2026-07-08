export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // /api/debug?matches=1 — recent match rows as stored (public info), to
  // diagnose result-sync issues without needing DB access.
  if (new URL(req.url).searchParams.get("matches")) {
    const { getAllMatches } = await import("@/lib/services/supabase");
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const recent = (await getAllMatches())
      .filter(m => new Date(m.kickoffUtc).getTime() >= cutoff && new Date(m.kickoffUtc).getTime() <= Date.now() + 24 * 60 * 60 * 1000)
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
      .map(m => ({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        kickoffUtc: m.kickoffUtc,
        status: m.status,
        result: m.result,
        score: m.homeScore != null ? `${m.homeScore}-${m.awayScore}` : null,
      }));
    return Response.json({ now: new Date().toISOString(), recent });
  }

  const checks = {
    GOOGLE_CLIENT_ID: (() => {
      const v = process.env.GOOGLE_CLIENT_ID ?? "";
      if (!v) return "MISSING";
      if (!v.includes(".apps.googleusercontent.com")) return `BAD FORMAT (got: ${v.slice(0, 20)}...)`;
      return "OK";
    })(),
    GOOGLE_CLIENT_SECRET: (() => {
      const v = process.env.GOOGLE_CLIENT_SECRET ?? "";
      if (!v) return "MISSING";
      if (!v.startsWith("GOCSPX-")) return `BAD FORMAT (got: ${v.slice(0, 10)}...)`;
      return "OK";
    })(),
    AUTH_SECRET: (() => {
      const v = process.env.AUTH_SECRET ?? "";
      if (!v) return "MISSING";
      if (v.length < 20) return "TOO SHORT";
      return "OK";
    })(),
    NEXTAUTH_SECRET: (() => {
      const v = process.env.NEXTAUTH_SECRET ?? "";
      if (!v) return "MISSING (optional if AUTH_SECRET is set)";
      return "OK";
    })(),
    NEXT_PUBLIC_SUPABASE_URL: (() => {
      const v = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      if (!v) return "MISSING";
      if (!v.startsWith("https://")) return `BAD FORMAT — missing https:// (got: ${v.slice(0, 20)}...)`;
      if (!v.includes(".supabase.co")) return `BAD FORMAT — not a supabase URL (got: ${v.slice(0, 40)}...)`;
      if (v.endsWith("/")) return "BAD FORMAT — has trailing slash";
      return "OK";
    })(),
    SUPABASE_SERVICE_ROLE_KEY: (() => {
      const v = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      if (!v) return "MISSING";
      if (!v.startsWith("eyJ")) return `BAD FORMAT — not a JWT (got: ${v.slice(0, 10)}...)`;
      return "OK";
    })(),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "OK" : "MISSING",
    AUTH_URL: process.env.AUTH_URL ? `OK (${process.env.AUTH_URL})` : "MISSING",
    CRON_SECRET: process.env.CRON_SECRET ? "OK" : "MISSING",
    FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY ? "OK" : "MISSING",
  };

  return Response.json(checks);
}
