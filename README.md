# OpenRouter Video Studio

Text-to-video generator built with Next.js, Vercel, and the official OpenRouter TypeScript SDK.

The app:

- Loads the live OpenRouter video model catalog from OpenRouter on every refresh
- Submits text-to-video jobs against any currently available model
- Polls async generation status until the clip is ready
- Surfaces pricing, supported durations, aspect ratios, resolutions, audio support, and seed support
- Supports app-level Basic Auth so the deployment can be access-restricted before anyone reaches your OpenRouter-backed routes

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

4. To protect the app locally and in production, also set:

```env
APP_BASIC_AUTH_USERNAME=your_username
APP_BASIC_AUTH_PASSWORD=a_long_random_password
```

5. Start the app:

```bash
npm run dev
```

## Deploy to Vercel

Set these environment variables in Vercel:

- `OPENROUTER_API_KEY`
- `OPENROUTER_APP_NAME`
- `OPENROUTER_SITE_URL`
- `APP_BASIC_AUTH_USERNAME`
- `APP_BASIC_AUTH_PASSWORD`

Then deploy with:

```bash
vercel
```

For production:

```bash
vercel --prod
```

## Protecting access

This project includes middleware-based HTTP Basic Auth. If `APP_BASIC_AUTH_USERNAME` and `APP_BASIC_AUTH_PASSWORD` are set, both the frontend and API routes require credentials before use.

That means:

- Your OpenRouter API key remains server-side only
- Casual public visitors cannot use the UI or call your generation endpoints
- This protection works regardless of whether Vercel production URLs are public on your plan
