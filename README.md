# AAM Global

Next.js site and admin for African Adventures Madagascar (AAM): public website, shop, inbox, fleet ops, and content.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # if present; otherwise set DATABASE_URL and other secrets
pnpm exec next dev --port 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127). Admin: `/admin` (password from `ADMIN_PASSWORD` / auth setup). Storekeeper fuel PWA: `/hisnik` (alias `/skladiscnik`; PIN from `CARETAKER_PIN`, local fallback `4242`).

## Public blog

- Index: `/blog` · posts are file-based in `lib/blog.ts` (no CMS)
- To add a post: append an entry to `POSTS` (newest first), set `slug`, `title`, `excerpt`, `date`, `heroImage` / `heroAlt`, and `body` paragraphs; the post page is `/blog/<slug>`
- First article: `/blog/big-game-fishing-nosy-komba` (uses `/images/fishing-biggame-sunset.png`)

## Admin analytics

- Path: **Web → Analytics** (`/admin/analytics`)
- First-party page views + visitor country (from Vercel `x-vercel-ip-country` headers on production)
- Complements **Vercel Web Analytics** (`@vercel/analytics`) — enable in the Vercel project dashboard under **Analytics** for their hosted charts; no extra env var required for the package once enabled

Local/dev traffic usually has empty country. Geo fills in after deploy to Vercel.

## Environment

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `DATABASE_URL` | Yes for DB-backed pages/admin | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes for better-auth | Auth secret |
| `BETTER_AUTH_URL` | Recommended locally | e.g. `http://127.0.0.1:43127` |
| `ADMIN_PASSWORD` | Optional | Simple admin gate (defaults to `9999` in code) |
| `CARETAKER_PIN` | Optional | PIN for `/hisnik` storekeeper (skladiščnik) fuel PWA (defaults to `4242` in code) |
| `RESEND_API_KEY` | Optional | Outbound email; skipped if unset |
| `RESEND_WEBHOOK_SECRET` | Optional | Inbound email webhook |
| `NOTIFY_EMAIL` / `EMAIL_FROM` | Optional | Email defaults exist in code |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob uploads (admin photos/docs) |
| `OPENAI_API_KEY` | Optional | Better inbox email translation (EN/SL); without it, free MyMemory is used |
| `OPENAI_TRANSLATE_MODEL` | Optional | OpenAI model for translation (default `gpt-4o-mini`) |
| `TRANSLATE_MOCK` | Optional | Set to `1` for a labelled local translation stand-in (no network) |

## Stack

Next.js (App Router), TypeScript, Tailwind, Neon Postgres, better-auth, Resend, Vercel Blob / Analytics.
