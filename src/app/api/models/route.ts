import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSessionEmail, isAllowedEmail, unauthorizedJson } from "@/lib/auth-helpers";
import { getApiKeyOverrideFromRequest, getOpenRouterClient } from "@/lib/openrouter";
import type { VideoModel } from "@/lib/video-types";

function normalizeModel(model: {
  allowedPassthroughParameters?: string[] | null;
  canonicalSlug: string;
  created: number;
  description?: string | null;
  generateAudio?: boolean | null;
  id: string;
  name: string;
  pricingSkus?: Record<string, string> | null;
  seed?: boolean | null;
  supportedAspectRatios?: string[] | null;
  supportedDurations?: number[] | null;
  supportedFrameImages?: string[] | null;
  supportedResolutions?: string[] | null;
  supportedSizes?: string[] | null;
}): VideoModel {
  return {
    allowedPassthroughParameters: model.allowedPassthroughParameters ?? [],
    canonicalSlug: model.canonicalSlug,
    created: model.created,
    description: model.description ?? undefined,
    generateAudio: Boolean(model.generateAudio),
    id: model.id,
    name: model.name,
    pricingSkus: model.pricingSkus ?? {},
    seed: Boolean(model.seed),
    supportedAspectRatios: model.supportedAspectRatios ?? [],
    supportedDurations: model.supportedDurations ?? [],
    supportedFrameImages: model.supportedFrameImages ?? [],
    supportedResolutions: model.supportedResolutions ?? [],
    supportedSizes: model.supportedSizes ?? [],
  };
}

export const GET = auth(async (request) => {
  if (!isAllowedEmail(getSessionEmail(request.auth))) {
    return unauthorizedJson();
  }

  try {
    const openRouter = getOpenRouterClient(getApiKeyOverrideFromRequest(request));
    const result = await openRouter.videoGeneration.listVideosModels();

    const models = result.data
      .map(normalizeModel)
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Unable to load video models", error);

    const message =
      error instanceof Error ? error.message : "Unable to load video models.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
