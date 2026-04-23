# OpenRouter Video Studio

Text-to-video generator built with Next.js, Vercel, and the official OpenRouter TypeScript SDK.

The app:

- Loads the live OpenRouter video model catalog from OpenRouter on every refresh
- Submits text-to-video jobs against any currently available model
- Polls async generation status until the clip is ready
- Surfaces pricing, supported durations, aspect ratios, resolutions, audio support, and seed support

## Local development

1. Install dependencies:

```bash
npm --userconfig /dev/null install
```

2. Copy the environment file:

```bash
cp .env.example .env.local
```

3. Set `OPENROUTER_API_KEY` in `.env.local`.

4. Start the app:

```bash
npm run dev
```

## Deploy to Vercel

Set these environment variables in Vercel:

- `OPENROUTER_API_KEY`
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
