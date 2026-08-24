# Publication Checklist

- Keep `.env*` files, `.data/`, generated video, and user prompts out of Git.
- Configure Google OAuth, a strong `AUTH_SECRET`, and exactly one
  `AUTHORIZED_EMAIL`; access fails closed when the allowlist is missing.
- Use a least-privilege OpenRouter key with a spending limit and rotate any key
  ever pasted into source, logs, issues, or chat.
- Use a dedicated database role and require TLS in `DATABASE_URL`.
- Run lint, type checking, build, dependency audit, current-tree secret scan,
  and full-history secret scan.
- Review prompts, reference images, and generated media for privacy and usage
  rights before sharing them.
- Choose an open-source license only if reuse rights should be granted.
