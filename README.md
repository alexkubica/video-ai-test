# OpenRouter Video Studio

Text-to-video generator built with Next.js, Vercel, and the official OpenRouter TypeScript SDK.

The app:

- Loads the live OpenRouter video model catalog from OpenRouter on every refresh
- Submits text-to-video jobs against any currently available model
- Polls async generation status until the clip is ready
- Surfaces pricing, supported durations, aspect ratios, resolutions, audio support, and seed support
- Uses Google sign-in with an exact server-side email allowlist before anyone
  reaches OpenRouter-backed pages or API routes

## Local development

1. Install dependencies:

```bash
npm ci
```

2. Copy the environment file:

```bash
cp .env.example .env.local
```

3. Replace every placeholder. `AUTHORIZED_EMAIL` is the only account allowed to
   sign in; missing auth configuration fails closed.

4. Start the app:

```bash
npm run dev
```

## Deploy to Vercel

Set these environment variables in Vercel:

- `OPENROUTER_API_KEY`
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTHORIZED_EMAIL`
- `OPENROUTER_APP_NAME`
- `OPENROUTER_SITE_URL`

Then deploy with:

```bash
vercel
```

For production:

```bash
vercel --prod
```

## Protecting access

This project uses Auth.js with Google OAuth. The proxy and every sensitive API
handler independently require a session whose normalized email exactly matches
`AUTHORIZED_EMAIL`.

That means:

- Your OpenRouter API key remains server-side only
- Casual public visitors cannot use the UI or call your generation endpoints
- This protection works regardless of whether Vercel production URLs are public on your plan

## Verification and publication

Run `npm run lint`, `npm run typecheck`, and `npm run build`. See
`docs/PUBLICATION.md` for the remaining release checks.

No open-source license has been selected; normal copyright restrictions apply.
