import { OpenRouter } from "@openrouter/sdk";

function normalizeSiteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

function resolveSiteUrl() {
  const configuredUrl =
    process.env.OPENROUTER_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!configuredUrl) {
    return "http://localhost:3000";
  }

  return normalizeSiteUrl(configuredUrl);
}

export function getApiKeyOverrideFromRequest(request: Request) {
  const apiKey = request.headers.get("x-openrouter-api-key")?.trim();

  return apiKey || undefined;
}

export function getOpenRouterClient(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  return new OpenRouter({
    apiKey,
    appCategories: "video-generation,web-app",
    appTitle: process.env.OPENROUTER_APP_NAME ?? "OpenRouter Video Studio",
    httpReferer: resolveSiteUrl(),
  });
}
