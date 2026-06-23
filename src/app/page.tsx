"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  PersistedVideoJob,
  VideoGenerationJob,
  VideoModel,
} from "@/lib/video-types";

type ReferenceImage = {
  dataUrl: string;
  id: string;
  name: string;
  size: number;
};

type FrameAsset = ReferenceImage | null;

type FormState = {
  aspectRatio: string;
  duration: string;
  firstFrameImage: FrameAsset;
  generateAudio: boolean;
  lastFrameImage: FrameAsset;
  modelId: string;
  prompt: string;
  referenceImages: ReferenceImage[];
  resolution: string;
  seed: string;
};

type SizeEstimate = {
  height: number;
  label: string;
  width: number;
};

type JobEstimate = {
  cost: number | null;
  costLabel: string;
  method: string;
  size: SizeEstimate | null;
  videoTokens: number | null;
};

type SupportedCombo = {
  aspectRatio: string;
  resolution: string;
  size: SizeEstimate;
};

const POLL_INTERVAL_SECONDS = 10;
const STARTER_PROMPTS = [
  "A sleek product reveal on a reflective table, soft studio lighting, slow camera orbit, premium commercial feel.",
  "Golden hour drone shot over a cliffside road, cinematic motion, rich contrast, realistic atmosphere.",
  "A cozy coffee shop window in light rain, shallow depth of field, subtle people movement, filmic realism.",
];

const INITIAL_PROMPT =
  "A handheld dolly shot through a neon-lit night market during light rain, cinematic reflections, shallow depth of field, realistic motion, subtle crowd movement.";

const SIZE_PRESETS: Record<string, Record<string, SizeEstimate>> = {
  "1:1": {
    "1080p": { height: 1080, label: "1080x1080", width: 1080 },
    "480p": { height: 480, label: "480x480", width: 480 },
    "4K": { height: 2160, label: "2160x2160", width: 2160 },
    "720p": { height: 720, label: "720x720", width: 720 },
  },
  "16:9": {
    "1080p": { height: 1080, label: "1920x1080", width: 1920 },
    "1K": { height: 1024, label: "1820x1024", width: 1820 },
    "2K": { height: 1440, label: "2560x1440", width: 2560 },
    "480p": { height: 480, label: "854x480", width: 854 },
    "4K": { height: 2160, label: "3840x2160", width: 3840 },
    "720p": { height: 720, label: "1280x720", width: 1280 },
  },
  "21:9": {
    "1080p": { height: 1080, label: "2520x1080", width: 2520 },
    "480p": { height: 480, label: "1120x480", width: 1120 },
    "4K": { height: 2160, label: "5040x2160", width: 5040 },
    "720p": { height: 720, label: "1680x720", width: 1680 },
  },
  "3:4": {
    "1080p": { height: 1440, label: "1080x1440", width: 1080 },
    "480p": { height: 640, label: "480x640", width: 480 },
    "4K": { height: 2880, label: "2160x2880", width: 2160 },
    "720p": { height: 960, label: "720x960", width: 720 },
  },
  "4:3": {
    "1080p": { height: 1080, label: "1440x1080", width: 1440 },
    "480p": { height: 480, label: "640x480", width: 640 },
    "4K": { height: 2160, label: "2880x2160", width: 2880 },
    "720p": { height: 720, label: "960x720", width: 960 },
  },
  "9:16": {
    "1080p": { height: 1920, label: "1080x1920", width: 1080 },
    "1K": { height: 1820, label: "1024x1820", width: 1024 },
    "2K": { height: 2560, label: "1440x2560", width: 1440 },
    "480p": { height: 854, label: "480x854", width: 480 },
    "4K": { height: 3840, label: "2160x3840", width: 2160 },
    "720p": { height: 1280, label: "720x1280", width: 720 },
  },
  "9:21": {
    "1080p": { height: 2520, label: "1080x2520", width: 1080 },
    "480p": { height: 1120, label: "480x1120", width: 480 },
    "4K": { height: 5040, label: "2160x5040", width: 2160 },
    "720p": { height: 1680, label: "720x1680", width: 720 },
  },
};

const PRICING_OVERRIDES: Record<string, Record<string, number>> = {
  "bytedance/seedance-2.0": {
    "1080p": 0.3402,
    "480p": 0.06726,
    "720p": 0.1512,
  },
  "bytedance/seedance-2.0-fast": {
    "1080p": 0.2722,
    "480p": 0.0538,
    "720p": 0.121,
  },
};

function getSupportedCombos(model: VideoModel): SupportedCombo[] {
  const combos: SupportedCombo[] = [];

  for (const [aspectRatio, resolutions] of Object.entries(SIZE_PRESETS)) {
    if (!model.supportedAspectRatios.includes(aspectRatio)) {
      continue;
    }

    for (const [resolution, size] of Object.entries(resolutions)) {
      if (!model.supportedResolutions.includes(resolution)) {
        continue;
      }

      if (
        model.supportedSizes.length > 0 &&
        !model.supportedSizes.includes(size.label)
      ) {
        continue;
      }

      combos.push({ aspectRatio, resolution, size });
    }
  }

  return combos;
}

function defaultComboForModel(model: VideoModel) {
  const combos = getSupportedCombos(model);

  if (model.id === "bytedance/seedance-2.0-fast") {
    const cheapestCombo = combos.find(
      (combo) => combo.aspectRatio === "1:1" && combo.resolution === "480p",
    );

    if (cheapestCombo) {
      return {
        aspectRatio: "1:1",
        duration: model.supportedDurations.includes(4) ? "4" : String(model.supportedDurations[0] ?? ""),
        resolution: "480p",
      };
    }
  }

  return {
    aspectRatio: combos[0]?.aspectRatio ?? model.supportedAspectRatios[0] ?? "",
    duration: String(model.supportedDurations[0] ?? ""),
    resolution: combos[0]?.resolution ?? model.supportedResolutions[0] ?? "",
  };
}

function syncFormForModel(current: FormState, model: VideoModel): FormState {
  const defaultCombo = defaultComboForModel(model);
  const combos = getSupportedCombos(model);
  const currentIsValid = combos.some(
    (combo) =>
      combo.aspectRatio === current.aspectRatio &&
      combo.resolution === current.resolution,
  );

  const nextCombo = currentIsValid
    ? { aspectRatio: current.aspectRatio, resolution: current.resolution }
    : defaultCombo;

  return {
    ...current,
    aspectRatio: nextCombo.aspectRatio,
    duration: pickDuration(defaultCombo.duration || current.duration, model.supportedDurations),
    firstFrameImage: model.supportedFrameImages.includes("first_frame")
      ? current.firstFrameImage
      : null,
    generateAudio: model.generateAudio ? current.generateAudio : false,
    lastFrameImage: model.supportedFrameImages.includes("last_frame")
      ? current.lastFrameImage
      : null,
    modelId: model.id,
    resolution: nextCombo.resolution,
    seed: model.seed ? current.seed : "",
  };
}

function pickDuration(current: string, supported: number[]) {
  if (!supported.length) {
    return "";
  }

  return supported.includes(Number(current)) ? current : String(supported[0]);
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) {
    return "Pending";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(value);
}

function formatEstimateCurrency(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(value);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(timestamp * 1000));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDurationCompact(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function statusTone(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
    case "cancelled":
    case "expired":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function isTerminalStatus(status: string) {
  return ["completed", "failed", "cancelled", "expired"].includes(status);
}

function parseSizeLabel(size: string): SizeEstimate | null {
  const match = /^(\d+)x(\d+)$/.exec(size);

  if (!match) {
    return null;
  }

  return {
    height: Number(match[2]),
    label: size,
    width: Number(match[1]),
  };
}

function aspectRatioValue(aspectRatio: string) {
  const [width, height] = aspectRatio.split(":").map(Number);

  if (!width || !height) {
    return null;
  }

  return width / height;
}

function isCloseAspect(size: SizeEstimate, aspectRatio: string) {
  const target = aspectRatioValue(aspectRatio);

  if (!target) {
    return true;
  }

  const actual = size.width / size.height;
  return Math.abs(actual - target) < 0.02;
}

function normalizeResolutionKey(resolution: string) {
  if (resolution === "1K") {
    return "1024p";
  }

  if (resolution === "2K") {
    return "1440p";
  }

  return resolution.toLowerCase();
}

function pickEstimatedSize(
  model: VideoModel,
  resolution: string,
  aspectRatio: string,
): SizeEstimate | null {
  const preset = SIZE_PRESETS[aspectRatio]?.[resolution];
  const parsedSizes = model.supportedSizes
    .map(parseSizeLabel)
    .filter((size): size is SizeEstimate => Boolean(size));

  if (preset && model.supportedSizes.includes(preset.label)) {
    return preset;
  }

  if (preset) {
    return preset;
  }

  if (!parsedSizes.length) {
    return null;
  }

  const matchingAspect = parsedSizes.find((size) =>
    isCloseAspect(size, aspectRatio),
  );

  return matchingAspect ?? parsedSizes[0];
}

function parseUnitPrice(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateVideoTokens(
  model: VideoModel,
  form: Pick<FormState, "aspectRatio" | "duration" | "resolution">,
) {
  const duration = Number(form.duration);
  const size = pickEstimatedSize(model, form.resolution, form.aspectRatio);

  if (!duration || !size) {
    return { size, videoTokens: null };
  }

  const videoTokens = Math.round((size.width * size.height * duration * 24) / 1024);
  return { size, videoTokens };
}

function estimateJob(
  model: VideoModel | null,
  form: FormState,
): JobEstimate | null {
  if (!model || !form.duration || !form.resolution || !form.aspectRatio) {
    return null;
  }

  const duration = Number(form.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const { size, videoTokens } = estimateVideoTokens(model, form);
  const pricing = model.pricingSkus;
  const resolutionKey = normalizeResolutionKey(form.resolution);
  const overridePrice = PRICING_OVERRIDES[model.id]?.[form.resolution];

  if (overridePrice !== undefined) {
    const cost = duration * overridePrice;

    return {
      cost,
      costLabel: formatEstimateCurrency(cost),
      method: `Estimated from current ${model.name} per-second pricing for ${form.resolution}.`,
      size,
      videoTokens,
    };
  }

  const tokenKey = form.generateAudio
    ? pricing.video_tokens ?? pricing.video_tokens_with_audio
    : pricing.video_tokens_without_audio ?? pricing.video_tokens;

  const tokenRate = parseUnitPrice(tokenKey);

  if (tokenRate !== null && videoTokens !== null) {
    const cost = videoTokens * tokenRate;

    return {
      cost,
      costLabel: formatEstimateCurrency(cost),
      method:
        "Estimated from OpenRouter video token pricing and the model-page token formula.",
      size,
      videoTokens,
    };
  }

  const candidateDurationKeys = [
    form.generateAudio && form.resolution === "4K"
      ? "duration_seconds_with_audio_4k"
      : null,
    !form.generateAudio && form.resolution === "4K"
      ? "duration_seconds_without_audio_4k"
      : null,
    form.generateAudio ? "duration_seconds_with_audio" : null,
    !form.generateAudio ? "duration_seconds_without_audio" : null,
    `text_to_video_duration_seconds_${resolutionKey}`,
    `duration_seconds_${resolutionKey}`,
    "duration_seconds",
  ].filter((key): key is string => Boolean(key));

  for (const key of candidateDurationKeys) {
    const unitPrice = parseUnitPrice(pricing[key]);

    if (unitPrice !== null) {
      const cost = duration * unitPrice;

      return {
        cost,
        costLabel: formatEstimateCurrency(cost),
        method: `Estimated from OpenRouter pricing SKU "${key}".`,
        size,
        videoTokens,
      };
    }
  }

  return {
    cost: null,
    costLabel: "Unavailable",
    method: "OpenRouter pricing metadata does not expose a directly usable estimator for this model.",
    size,
    videoTokens,
  };
}

function getModelPageUrl(modelId: string) {
  return `https://openrouter.ai/${modelId}`;
}

function getVideoProxyUrl(jobId: string, index = 0) {
  return `/api/jobs/${jobId}/content?index=${index}`;
}

function readableBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function modelCapabilitySummary(model: VideoModel | null) {
  if (!model) {
    return "Loading model details";
  }

  const parts = [
    model.generateAudio ? "audio" : "silent",
    model.seed ? "repeatable takes" : null,
    model.supportedFrameImages.length ? "frame control" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

async function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

  return {
    dataUrl,
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    size: file.size,
  };
}

async function fileToFrameAsset(file: File): Promise<ReferenceImage> {
  return fileToReferenceImage(file);
}

export default function Home() {
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobHistory, setJobHistory] = useState<PersistedVideoJob[]>([]);
  const [job, setJob] = useState<VideoGenerationJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [userApiKey, setUserApiKey] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("openrouter_user_api_key") ?? "";
  });
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [videoObjectJobId, setVideoObjectJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    aspectRatio: "",
    duration: "",
    firstFrameImage: null,
    generateAudio: true,
    lastFrameImage: null,
    modelId: "",
    prompt: INITIAL_PROMPT,
    referenceImages: [],
    resolution: "",
    seed: "",
  });

  const authHeaders = useMemo(
    (): Record<string, string> =>
      userApiKey.trim()
        ? { "x-openrouter-api-key": userApiKey.trim() }
        : {},
    [userApiKey],
  );

  useEffect(() => {
    if (userApiKey.trim()) {
      window.localStorage.setItem("openrouter_user_api_key", userApiKey.trim());
      return;
    }

    window.localStorage.removeItem("openrouter_user_api_key");
  }, [userApiKey]);

  useEffect(() => {
    let isCancelled = false;

    async function loadModels() {
      try {
        setIsLoadingModels(true);
        setModelsError("");

        const response = await fetch("/api/models", {
          cache: "no-store",
          headers: authHeaders,
        });
        const payload = (await response.json()) as {
          error?: string;
          models?: VideoModel[];
        };

        if (!response.ok || !payload.models) {
          throw new Error(payload.error ?? "Unable to load models.");
        }

        const nextModels = payload.models;

        if (!isCancelled) {
          setModels(nextModels);

          const preferredModel =
            nextModels.find(
              (model) => model.id === "bytedance/seedance-2.0-fast",
            ) ?? nextModels[0];

          if (preferredModel) {
            setForm((current) => syncFormForModel(current, preferredModel));
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setModelsError(
            error instanceof Error ? error.message : "Unable to load models.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingModels(false);
        }
      }
    }

    loadModels();

    return () => {
      isCancelled = true;
    };
  }, [authHeaders]);

  useEffect(() => {
    let isCancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch("/api/history", { cache: "no-store" });
        const payload = (await response.json()) as {
          error?: string;
          jobs?: PersistedVideoJob[];
        };

        if (!response.ok || !payload.jobs) {
          throw new Error(payload.error ?? "Unable to load job history.");
        }

        if (!isCancelled) {
          setJobHistory(payload.jobs);
          setJob((current) => current ?? payload.jobs?.[0] ?? null);
        }
      } catch (error) {
        if (!isCancelled) {
          setJobError(
            error instanceof Error ? error.message : "Unable to load job history.",
          );
        }
      }
    }

    loadHistory();

    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === form.modelId) ?? null,
    [form.modelId, models],
  );

  const supportedCombos = useMemo(
    () => (selectedModel ? getSupportedCombos(selectedModel) : []),
    [selectedModel],
  );

  const availableResolutions = useMemo(() => {
    const filtered = supportedCombos.filter(
      (combo) => !form.aspectRatio || combo.aspectRatio === form.aspectRatio,
    );
    return [...new Set(filtered.map((combo) => combo.resolution))];
  }, [form.aspectRatio, supportedCombos]);

  const availableAspectRatios = useMemo(() => {
    const filtered = supportedCombos.filter(
      (combo) => !form.resolution || combo.resolution === form.resolution,
    );
    return [...new Set(filtered.map((combo) => combo.aspectRatio))];
  }, [form.resolution, supportedCombos]);

  const estimate = useMemo(
    () => estimateJob(selectedModel, form),
    [form, selectedModel],
  );

  const jobElapsedSeconds =
    job?.createdAt && (job?.updatedAt || !isTerminalStatus(job.status))
      ? Math.max(
          0,
          Math.floor(
            (
              (job.updatedAt && isTerminalStatus(job.status)
                ? new Date(job.updatedAt).getTime()
                : nowMs) - new Date(job.createdAt).getTime()
            ) / 1000,
          ),
        )
      : 0;

  const refreshHistory = useCallback(async () => {
    const response = await fetch("/api/history", { cache: "no-store" });
    const payload = (await response.json()) as {
      error?: string;
      jobs?: PersistedVideoJob[];
    };

    if (!response.ok || !payload.jobs) {
      throw new Error(payload.error ?? "Unable to load job history.");
    }

    setJobHistory(payload.jobs);
    return payload.jobs;
  }, []);

  const refreshSelectedJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}`, {
      cache: "no-store",
      headers: authHeaders,
    });
    const payload = (await response.json()) as VideoGenerationJob & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh job status.");
    }

    const jobs = await refreshHistory().catch(() => null);
    const persisted = jobs?.find((entry) => entry.id === jobId);

    setJob(persisted ?? payload);
    return persisted ?? payload;
  }, [authHeaders, refreshHistory]);

  const loadVideoContent = useCallback(async (jobId: string) => {
    const response = await fetch(getVideoProxyUrl(jobId), {
      cache: "no-store",
      headers: authHeaders,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? "Unable to load video content.");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }, [authHeaders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!job || !["pending", "in_progress"].includes(job.status)) {
      return;
    }

    const poll = window.setInterval(async () => {
      try {
        await refreshSelectedJob(job.id);
      } catch (error) {
        setJobError(
          error instanceof Error
            ? error.message
            : "Unable to refresh job status.",
        );
      }
    }, POLL_INTERVAL_SECONDS * 1000);

    return () => {
      window.clearInterval(poll);
    };
  }, [job, refreshSelectedJob]);

  useEffect(() => {
    if (job?.status !== "completed") {
      return;
    }

    let isCancelled = false;

    void loadVideoContent(job.id)
      .then((objectUrl) => {
        if (isCancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setVideoObjectUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
        setVideoObjectJobId(job.id);
      })
      .catch((error) => {
        if (!isCancelled) {
          setJobError(
            error instanceof Error
              ? error.message
              : "Unable to load video content.",
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [job?.id, job?.status, loadVideoContent]);

  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [videoObjectUrl]);

  async function handleReferenceImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    try {
      const nextImages = await Promise.all(files.map(fileToReferenceImage));

      setForm((current) => ({
        ...current,
        referenceImages: [...current.referenceImages, ...nextImages],
      }));
    } catch (error) {
      setJobError(
        error instanceof Error
          ? error.message
          : "Unable to load reference images.",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleFrameImageChange(
    event: ChangeEvent<HTMLInputElement>,
    field: "firstFrameImage" | "lastFrameImage",
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const nextImage = await fileToFrameAsset(file);

      setForm((current) => ({
        ...current,
        [field]: nextImage,
      }));
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : "Unable to load frame image.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function removeReferenceImage(imageId: string) {
    setForm((current) => ({
      ...current,
      referenceImages: current.referenceImages.filter(
        (image) => image.id !== imageId,
      ),
    }));
  }

  function removeFrameImage(field: "firstFrameImage" | "lastFrameImage") {
    setForm((current) => ({
      ...current,
      [field]: null,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setJobError("");

    try {
      const response = await fetch("/api/generate", {
        body: JSON.stringify({
          aspectRatio: form.aspectRatio || undefined,
          duration: form.duration || undefined,
          frameImages: [
            form.firstFrameImage
              ? {
                  frameType: "first_frame",
                  imageUrl: { url: form.firstFrameImage.dataUrl },
                  type: "image_url",
                }
              : null,
            form.lastFrameImage
              ? {
                  frameType: "last_frame",
                  imageUrl: { url: form.lastFrameImage.dataUrl },
                  type: "image_url",
                }
              : null,
          ].filter(Boolean),
          generateAudio: selectedModel?.generateAudio ? form.generateAudio : false,
          inputReferences: form.referenceImages.map((image) => ({
            imageUrl: { url: image.dataUrl },
            type: "image_url",
          })),
          model: form.modelId,
          prompt: form.prompt,
          resolution: form.resolution || undefined,
          seed: form.seed || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        method: "POST",
      });

      const payload = (await response.json()) as VideoGenerationJob & {
        error?: string;
      };

      if (!response.ok) {
        const message = [payload.error, payload.errorHint]
          .filter(Boolean)
          .join(" ");
        const nextError = new Error(message || "Unable to start generation.");
        throw nextError;
      }

      setJob(payload);
      const jobs = await refreshHistory();
      const persisted = jobs.find((entry) => entry.id === payload.id);
      setJob(persisted ?? payload);
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : "Unable to start generation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleApiKeyChange(event: ChangeEvent<HTMLInputElement>) {
    setUserApiKey(event.target.value);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[92rem] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-5 shadow-[var(--shadow)] backdrop-blur sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_34%),radial-gradient(circle_at_85%_15%,rgba(255,106,61,0.18),transparent_22%),linear-gradient(135deg,transparent,rgba(255,255,255,0.25))]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.8fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-[var(--border-strong)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                Frameflow
              </span>
              <span className="text-sm text-[var(--muted)]">
                Prompt in. Clip out.
              </span>
            </div>

            <div className="max-w-4xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-5xl lg:text-7xl">
                Make short videos with less setup.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Pick a model, describe the scene, and render. Advanced controls stay
                available, but they no longer get in your way.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.4rem] border border-[var(--border)] bg-white/72 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Models live
                </p>
                <p className="mt-3 text-3xl font-semibold">{models.length}</p>
              </article>
              <article className="rounded-[1.4rem] border border-[var(--border)] bg-white/72 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Audio-ready
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {models.filter((model) => model.generateAudio).length}
                </p>
              </article>
              <article className="rounded-[1.4rem] border border-[var(--border)] bg-white/72 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Best first try
                </p>
                <p className="mt-3 text-lg font-semibold">
                  {selectedModel?.name ?? "Loading"}
                </p>
              </article>
            </div>
          </div>

          <aside className="flex h-full flex-col justify-between rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">Current model</p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedModel?.name ?? "Loading"}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusTone(
                    job?.status ?? "pending",
                  )}`}
                >
                  {job?.status ?? "ready"}
                </span>
              </div>

              <p className="text-sm leading-6 text-[var(--muted)]">
                {selectedModel?.description ??
                  "Video settings will appear when the model list finishes loading."}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] bg-white/78 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Good for
                  </p>
                  <p className="mt-2 text-sm font-semibold capitalize">
                    {modelCapabilitySummary(selectedModel)}
                  </p>
                </div>
                <div className="rounded-[1.3rem] bg-white/78 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Released
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {selectedModel ? formatDate(selectedModel.created) : "Pending"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                href={selectedModel ? getModelPageUrl(selectedModel.id) : "#"}
                rel="noreferrer"
                target="_blank"
              >
                Model page
              </a>
              <a
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                href="https://openrouter.ai/docs/guides/overview/multimodal/video-generation/"
                rel="noreferrer"
                target="_blank"
              >
                API docs
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <form
          className="space-y-5 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)] backdrop-blur sm:p-6"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-3 rounded-[1.6rem] border border-[var(--border)] bg-white/72 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Create
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Keep it simple. Start with the prompt and four settings.
                </p>
              </div>
              <label className="min-w-[16rem] flex-1 sm:max-w-xs">
                <span className="sr-only">OpenRouter API key</span>
                <input
                  autoComplete="off"
                  className="w-full rounded-full border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                  id="user-api-key"
                  onChange={handleApiKeyChange}
                  placeholder="Optional OpenRouter key"
                  type="password"
                  value={userApiKey}
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-[var(--muted)]">
              Your key stays in this browser unless requests are sent from it.
            </p>
          </div>

          <div className="space-y-3 rounded-[1.8rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:p-5">
            <label className="block text-sm font-medium" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              className="min-h-44 w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--input)] px-4 py-4 text-base outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
              id="prompt"
              onChange={(event) =>
                setForm((current) => ({ ...current, prompt: event.target.value }))
              }
              placeholder="A polished product reveal, dramatic lighting, slow camera move..."
              value={form.prompt}
            />
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-2 text-xs font-medium text-[var(--muted-strong)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      prompt,
                    }))
                  }
                  type="button"
                >
                  Try a sample
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Model</span>
              <select
                className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                onChange={(event) =>
                  setForm((current) => {
                    const nextModel = models.find(
                      (model) => model.id === event.target.value,
                    );

                    if (!nextModel) {
                      return current;
                    }

                    return syncFormForModel(current, nextModel);
                  })
                }
                value={form.modelId}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Length</span>
              <select
                className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                disabled={!selectedModel?.supportedDurations.length}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    duration: event.target.value,
                  }))
                }
                value={form.duration}
              >
                {selectedModel?.supportedDurations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}s
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Format</span>
              <select
                className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                disabled={!availableAspectRatios.length}
                onChange={(event) =>
                  setForm((current) => {
                    const nextAspectRatio = event.target.value;
                    const nextResolution =
                      supportedCombos.find(
                        (combo) =>
                          combo.aspectRatio === nextAspectRatio &&
                          combo.resolution === current.resolution,
                      )?.resolution ??
                      supportedCombos.find(
                        (combo) => combo.aspectRatio === nextAspectRatio,
                      )?.resolution ??
                      current.resolution;

                    return {
                      ...current,
                      aspectRatio: nextAspectRatio,
                      resolution: nextResolution,
                    };
                  })
                }
                value={form.aspectRatio}
              >
                {availableAspectRatios.map((aspectRatio) => (
                  <option key={aspectRatio} value={aspectRatio}>
                    {aspectRatio}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Quality</span>
              <select
                className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                disabled={!availableResolutions.length}
                onChange={(event) =>
                  setForm((current) => {
                    const nextResolution = event.target.value;
                    const nextAspect =
                      supportedCombos.find(
                        (combo) =>
                          combo.resolution === nextResolution &&
                          combo.aspectRatio === current.aspectRatio,
                      )?.aspectRatio ??
                      supportedCombos.find(
                        (combo) => combo.resolution === nextResolution,
                      )?.aspectRatio ??
                      current.aspectRatio;

                    return {
                      ...current,
                      aspectRatio: nextAspect,
                      resolution: nextResolution,
                    };
                  })
                }
                value={form.resolution}
              >
                {availableResolutions.map((resolution) => (
                  <option key={resolution} value={resolution}>
                    {resolution}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {estimate ? (
            <div className="grid gap-3 rounded-[1.7rem] border border-[var(--border)] bg-white/72 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Estimated cost
                </p>
                <p className="mt-2 text-xl font-semibold">{estimate.costLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Render size
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {estimate.size?.label ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Tokens
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {estimate.videoTokens?.toLocaleString() ?? "N/A"}
                </p>
              </div>
              <p className="sm:col-span-3 text-sm leading-6 text-[var(--muted)]">
                {estimate.method}
              </p>
            </div>
          ) : null}

          <details className="group rounded-[1.7rem] border border-[var(--border)] bg-white/70 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Advanced
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Seed, audio, frames, and references.
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <label className="space-y-2 text-sm font-medium">
                  <span>Seed</span>
                  <input
                    className="w-full rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(255,106,61,0.12)]"
                    disabled={!selectedModel?.seed}
                    inputMode="numeric"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        seed: event.target.value,
                      }))
                    }
                    placeholder={
                      selectedModel?.seed ? "Optional" : "Not supported"
                    }
                    value={form.seed}
                  />
                </label>

                <label className="flex items-end gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm font-medium">
                  <input
                    checked={form.generateAudio}
                    disabled={!selectedModel?.generateAudio}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        generateAudio: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Audio
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium" htmlFor="first-frame-image">
                      First frame
                    </label>
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Optional
                    </span>
                  </div>
                  <input
                    accept="image/*"
                    className="block w-full rounded-[1.1rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:font-medium file:text-[var(--accent-strong)]"
                    disabled={!selectedModel?.supportedFrameImages.includes("first_frame")}
                    id="first-frame-image"
                    onChange={(event) =>
                      handleFrameImageChange(event, "firstFrameImage")
                    }
                    type="file"
                  />
                  {form.firstFrameImage ? (
                    <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/80 p-3 text-sm">
                      <span className="truncate">{form.firstFrameImage.name}</span>
                      <button
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium"
                        onClick={() => removeFrameImage("firstFrameImage")}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium" htmlFor="last-frame-image">
                      Last frame
                    </label>
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Optional
                    </span>
                  </div>
                  <input
                    accept="image/*"
                    className="block w-full rounded-[1.1rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:font-medium file:text-[var(--accent-strong)]"
                    disabled={!selectedModel?.supportedFrameImages.includes("last_frame")}
                    id="last-frame-image"
                    onChange={(event) =>
                      handleFrameImageChange(event, "lastFrameImage")
                    }
                    type="file"
                  />
                  {form.lastFrameImage ? (
                    <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-white/80 p-3 text-sm">
                      <span className="truncate">{form.lastFrameImage.name}</span>
                      <button
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium"
                        onClick={() => removeFrameImage("lastFrameImage")}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium" htmlFor="reference-images">
                    Reference images
                  </label>
                  <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Multi-upload
                  </span>
                </div>
                <input
                  accept="image/*"
                  className="block w-full rounded-[1.1rem] border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:font-medium file:text-[var(--accent-strong)]"
                  id="reference-images"
                  multiple
                  onChange={handleReferenceImageChange}
                  type="file"
                />
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Use reference images to steer the look. If frame images are also
                  present, they take priority.
                </p>
                {form.referenceImages.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {form.referenceImages.map((image) => (
                      <div
                        key={image.id}
                        className="overflow-hidden rounded-[1.3rem] border border-[var(--border)] bg-white/78"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={image.name}
                          className="aspect-square w-full object-cover"
                          src={image.dataUrl}
                        />
                        <div className="space-y-2 p-3">
                          <p className="truncate text-sm font-medium">{image.name}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {readableBytes(image.size)}
                          </p>
                          <button
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                            onClick={() => removeReferenceImage(image.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </details>

          {modelsError ? (
            <p className="rounded-[1.2rem] bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {modelsError}
            </p>
          ) : null}

          {jobError ? (
            <p className="rounded-[1.2rem] bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {jobError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 rounded-[1.8rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {isLoadingModels
                ? "Loading available video models..."
                : "Rendering starts an async job and updates automatically."}
            </p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={
                isLoadingModels ||
                isSubmitting ||
                !form.modelId ||
                !form.prompt.trim()
              }
              type="submit"
            >
              {isSubmitting ? "Starting render..." : "Generate video"}
            </button>
          </div>
        </form>

        <section className="space-y-5 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)] backdrop-blur sm:p-6">
          <div className="rounded-[1.8rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Latest render</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {job ? `Job ${job.id}` : "Nothing rendered yet"}
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusTone(
                  job?.status ?? "pending",
                )}`}
              >
                {job?.status ?? "idle"}
              </span>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white/65 p-3">
              {job?.status === "completed" &&
              videoObjectUrl &&
              videoObjectJobId === job.id ? (
                <video
                  className="aspect-video w-full rounded-[1.2rem] bg-[#100d11] object-cover"
                  controls
                  src={videoObjectUrl}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(255,106,61,0.12),rgba(18,25,40,0.04),rgba(255,255,255,0.82))] p-6 text-center text-sm leading-6 text-[var(--muted)]">
                  {job?.status === "completed"
                    ? "Render is ready. Loading the preview now."
                    : "Your finished clip will show up here."}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[1.2rem] bg-white/78 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {job && isTerminalStatus(job.status) ? "Render time" : "Started"}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {job
                    ? isTerminalStatus(job.status)
                      ? formatDurationCompact(jobElapsedSeconds)
                      : job.createdAt
                        ? formatDateTime(job.createdAt)
                        : "Pending"
                    : "Pending"}
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white/78 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Submitted
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {job?.createdAt ? formatDateTime(job.createdAt) : "Pending"}
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white/78 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Updated
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {job?.updatedAt ? formatDateTime(job.updatedAt) : "Pending"}
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white/78 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Cost
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency(job?.usage?.cost)}
                </p>
              </article>
            </div>

            {job?.error ? (
              <p className="mt-4 rounded-[1.2rem] bg-rose-100 px-4 py-3 text-sm text-rose-800">
                {job.error}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="space-y-4 rounded-[1.7rem] border border-[var(--border)] bg-white/72 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Selected model
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Simple summary of what it can do.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.3rem] bg-[var(--panel)] p-4">
                <p className="text-lg font-semibold">
                  {selectedModel?.name ?? "Loading"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {selectedModel?.description ??
                    "Model details will appear here once loaded."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Extra controls
                </p>
                <div className="flex flex-wrap gap-2">
                  {(selectedModel?.allowedPassthroughParameters.length
                    ? selectedModel.allowedPassthroughParameters
                    : ["No extra controls exposed"]).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs text-[var(--muted-strong)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {selectedModel ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Pricing signals
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedModel.pricingSkus).length ? (
                      Object.entries(selectedModel.pricingSkus).map(([sku, price]) => (
                        <span
                          key={sku}
                          className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]"
                        >
                          {sku}: ${price}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs text-[var(--muted)]">
                        No pricing metadata
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-[1.7rem] border border-[var(--border)] bg-white/72 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Recent renders
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Saved in Neon.
                  </p>
                </div>
              </div>

              <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
                {jobHistory.length ? (
                  jobHistory.map((historyJob) => (
                    <button
                      key={historyJob.id}
                      className="w-full rounded-[1.3rem] border border-[var(--border)] bg-[var(--panel)] p-4 text-left hover:border-[var(--accent)]"
                      onClick={() => {
                        setJob(historyJob);
                        setJobError("");
                        void refreshSelectedJob(historyJob.id).catch((error) => {
                          setJobError(
                            error instanceof Error
                              ? error.message
                              : "Unable to refresh job status.",
                          );
                        });
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">
                          {historyJob.model}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTone(
                            historyJob.status,
                          )}`}
                        >
                          {historyJob.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {historyJob.prompt}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                        <span>{formatDateTime(historyJob.createdAt)}</span>
                        <span>{historyJob.resolution ?? "No quality"}</span>
                        <span>
                          {historyJob.duration ? `${historyJob.duration}s` : "No length"}
                        </span>
                        <span>
                          {historyJob.referenceImageCount} reference
                          {historyJob.referenceImageCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[1.3rem] border border-dashed border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
                    No renders yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
