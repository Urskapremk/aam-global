# AAM Global

Next.js site and admin for African Adventures Madagascar (AAM): public website, shop, inbox, fleet ops, and content.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # if present; otherwise set DATABASE_URL and other secrets
pnpm exec next dev --port 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127). Admin: `/admin` (password from `ADMIN_PASSWORD` / auth setup).

## Public blog

- Index: `/blog` · posts are file-based in `lib/blog.ts` (no CMS)
- To add a post: append an entry to `POSTS` (newest first), set `slug`, `title`, `excerpt`, `date`, `heroImage` / `heroAlt`, and `body` paragraphs; the post page is `/blog/<slug>`
- First article: `/blog/big-game-fishing-nosy-komba` (uses `/images/fishing-biggame-sunset.png`)

## Admin analytics

- Path: **Web → Analytics** (`/admin/analytics`)
- First-party page views + visitor country (from Vercel `x-vercel-ip-country` headers on production)
- Complements **Vercel Web Analytics** (`@vercel/analytics`) — enable in the Vercel project dashboard under **Analytics** for their hosted charts; no extra env var required for the package once enabled

Local/dev traffic usually has empty country. Geo fills in after deploy to Vercel.

## Stack

Next.js (App Router), TypeScript, Tailwind, Neon Postgres, better-auth, Resend, Vercel Blob / Analytics.
