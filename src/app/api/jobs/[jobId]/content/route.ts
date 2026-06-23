import { auth } from "@/auth";
import { getSessionEmail, isAllowedEmail, unauthorizedJson } from "@/lib/auth-helpers";
import { getApiKeyOverrideFromRequest } from "@/lib/openrouter";

function toSafeIndex(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export const GET = auth(async (
  request,
  { params }: { params: Promise<{ jobId: string }> },
) => {
  if (!isAllowedEmail(getSessionEmail(request.auth))) {
    return unauthorizedJson();
  }

  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const index = toSafeIndex(searchParams.get("index"));
    const apiKey =
      getApiKeyOverrideFromRequest(request) ?? process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENROUTER_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const upstreamUrl = new URL(
      `https://openrouter.ai/api/v1/videos/${jobId}/content`,
    );
    upstreamUrl.searchParams.set("index", String(index));

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-OpenRouter-Categories": "video-generation,web-app",
        "X-OpenRouter-Title":
          process.env.OPENROUTER_APP_NAME ?? "OpenRouter Video Studio",
      },
      method: "GET",
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const bodyText = await upstreamResponse.text().catch(() => "");
      console.error("Unable to load video content from OpenRouter", {
        bodyText,
        status: upstreamResponse.status,
      });

      return Response.json(
        {
          error:
            bodyText ||
            `Unable to load video content. OpenRouter returned ${upstreamResponse.status}.`,
        },
        { status: upstreamResponse.status || 500 },
      );
    }

    return new Response(upstreamResponse.body, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Type":
          upstreamResponse.headers.get("content-type") ?? "application/octet-stream",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Unable to load video content", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load video content.",
      },
      { status: 500 },
    );
  }
});
