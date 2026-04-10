# Airport TSA Wait Time Tracker

A Next.js app that displays recent TSA checkpoint wait times collected from public airport websites and stored in Supabase.

Currently included:

- JFK
- Newark
- LaGuardia
- Atlanta
- Houston IAH

## Stack

- Next.js
- React
- Supabase
- Firecrawl
- OpenAI
- GitHub Actions

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

3. Fill in the required values in `.env.local`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIRECRAWL_API_KEY`
- `OPENAI_API_KEY`
- `COLLECT_SECRET`

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Notes

- `.env.local` is ignored and should never be committed.
- `.vercel/` is ignored and contains local Vercel linkage metadata.
- GitHub Actions expect the same secrets to be configured in the repository settings.

## Data Collection

Collection scripts live in `scripts/collect.mjs` and the related airport-specific files in `scripts/`.

The app also exposes:

- history endpoints under `app/api/`
- a protected collect endpoint at `app/api/collect/route.ts`
- a health endpoint at `app/api/health/route.ts`

## Before Making The Repo Public

- Confirm `.env.local` is still untracked with `git status --short`.
- Confirm GitHub Actions secrets are set in the repository before enabling workflows.
- If any real secrets were ever committed in a previous branch or clone, rewrite history before publishing.

## License

Add a license before publishing publicly if you want to define reuse terms.
