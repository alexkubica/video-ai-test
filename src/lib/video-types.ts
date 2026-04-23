export type VideoModel = {
  allowedPassthroughParameters: string[];
  canonicalSlug: string;
  created: number;
  description?: string;
  generateAudio: boolean;
  id: string;
  name: string;
  pricingSkus: Record<string, string>;
  seed: boolean;
  supportedAspectRatios: string[];
  supportedDurations: number[];
  supportedFrameImages: string[];
  supportedResolutions: string[];
  supportedSizes: string[];
};

export type VideoGenerationJob = {
  error?: string;
  generationId?: string;
  id: string;
  pollingUrl: string;
  status: string;
  unsignedUrls: string[];
  usage?: {
    cost?: number | null;
    isByok?: boolean | null;
  };
};
