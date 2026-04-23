import { getOpenRouterClient } from "@/lib/openrouter";

function toSafeIndex(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const index = toSafeIndex(searchParams.get("index"));
    const openRouter = getOpenRouterClient();
    const stream = await openRouter.videoGeneration.getVideoContent({
      index,
      jobId,
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Type": "video/mp4",
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
}
