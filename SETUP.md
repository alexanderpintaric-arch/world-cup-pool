# Setup Guide

## 1. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → New Project
2. APIs & Services → OAuth consent screen → External → fill in app name + your email
3. Credentials → Create OAuth Client ID → Web application
4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (dev) + `https://yourdomain.vercel.app/api/auth/callback/google` (prod)
5. Copy Client ID + Secret → `.env.local`

## 2. Google Sheets

### Create the spreadsheet
1. Create a new Google Sheet
2. Create 5 sheets (tabs) named exactly:
   - `matches`
   - `picks`
   - `users`
   - `odds`
   - `sync_log`
3. Add header rows:

**matches:** `match_id | round | home_team | away_team | result | status | kickoff_utc | points_value | home_score | away_score`

**picks:** `email | match_id | round | pick | submitted_at | updated_at`

**users:** `email | name | created_at`

**odds:** `match_id | home_odds | draw_odds | away_odds | home_prob | draw_prob | away_prob | updated_at`

**sync_log:** `synced_at | matches_updated | rounds_opened | emails_sent | error`

4. Copy the Spreadsheet ID from the URL (the long string between `/d/` and `/edit`)

### Create a Service Account
1. Google Cloud Console → APIs & Services → Credentials → Create Service Account
2. Name it anything, skip optional steps
3. Click the service account → Keys → Add Key → JSON → download
4. Share your Google Sheet with the service account email (Editor access)
5. Set env vars:
   - `GOOGLE_SHEETS_ID` = the spreadsheet ID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = the service account email
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = the `private_key` field from the JSON (keep the `\n` characters)

## 3. football-data.org

1. Register at [football-data.org/client/register](https://www.football-data.org/client/register)
2. Free tier — no credit card needed
3. Copy your API token → `FOOTBALL_DATA_API_KEY`

## 4. The Odds API

1. Register at [the-odds-api.com](https://the-odds-api.com)
2. Free tier: 500 requests/month (we cache aggressively, this is enough)
3. Copy your API key → `ODDS_API_KEY`

## 5. Resend (emails)

1. Register at [resend.com](https://resend.com)
2. Add + verify your sending domain (or use the sandbox for testing)
3. Create an API key → `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to `pool@yourdomain.com`

## 6. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

1. Import project, set all env vars in the Vercel dashboard
2. Add `CRON_SECRET` — any random string (e.g. `openssl rand -hex 32`)
3. The cron job in `vercel.json` runs every 15 minutes automatically on Vercel Pro/Hobby

## 7. Run locally

```bash
cp .env.local.example .env.local
# fill in all values
npm run dev
```

Visit `http://localhost:3000`

## Admin

Navigate to `/admin` while signed in with `ADMIN_EMAIL` to access the sync dashboard.
