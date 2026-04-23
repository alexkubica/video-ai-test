"use client";

import { useEffect, useMemo, useState } from "react";

import type { VideoGenerationJob, VideoModel } from "@/lib/video-types";

type FormState = {
  aspectRatio: string;
  duration: string;
  generateAudio: boolean;
  modelId: string;
  prompt: string;
  resolution: string;
  seed: string;
};

const INITIAL_PROMPT =
  "A handheld dolly shot through a neon-lit night market during light rain, cinematic reflections, shallow depth of field, realistic motion, subtle crowd movement.";

function syncFormForModel(current: FormState, model: VideoModel): FormState {
  return {
    ...current,
    aspectRatio: pickOption(current.aspectRatio, model.supportedAspectRatios),
    duration: pickDuration(current.duration, model.supportedDurations),
    generateAudio: model.generateAudio ? current.generateAudio : false,
    modelId: model.id,
    resolution: pickOption(current.resolution, model.supportedResolutions),
    seed: model.seed ? current.seed : "",
  };
}

function pickOption(current: string, supported: string[]) {
  if (!supported.length) {
    return "";
  }

  return supported.includes(current) ? current : supported[0];
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

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(timestamp * 1000));
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

export default function Home() {
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [job, setJob] = useState<VideoGenerationJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [form, setForm] = useState<FormState>({
    aspectRatio: "",
    duration: "",
    generateAudio: true,
    modelId: "",
    prompt: INITIAL_PROMPT,
    resolution: "",
    seed: "",
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadModels() {
      try {
        setIsLoadingModels(true);
        setModelsError("");

        const response = await fetch("/api/models", { cache: "no-store" });
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

          if (nextModels[0]) {
            setForm((current) => syncFormForModel(current, nextModels[0]));
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
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === form.modelId) ?? null,
    [form.modelId, models],
  );

  useEffect(() => {
    if (!job || !["pending", "in_progress"].includes(job.status)) {
      return;
    }

    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      const payload = (await response.json()) as VideoGenerationJob & {
        error?: string;
      };

      if (!response.ok) {
        setJobError(payload.error ?? "Unable to refresh job status.");
        return;
      }

      setJob(payload);
    }, 5000);

    return () => window.clearInterval(poll);
  }, [job]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setJobError("");

    try {
      const response = await fetch("/api/generate", {
        body: JSON.stringify({
          aspectRatio: form.aspectRatio || undefined,
          duration: form.duration || undefined,
          generateAudio: selectedModel?.generateAudio ? form.generateAudio : false,
          model: form.modelId,
          prompt: form.prompt,
          resolution: form.resolution || undefined,
          seed: form.seed || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as VideoGenerationJob & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start generation.");
      }

      setJob(payload);
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : "Unable to start generation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)] backdrop-blur">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              OpenRouter SDK + Vercel
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl lg:text-6xl">
                Generate text-to-video with the full OpenRouter catalog.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                The model list is loaded live from OpenRouter’s video models API,
                so newly added providers appear without a redeploy.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Live Models
                </p>
                <p className="mt-3 text-3xl font-semibold">{models.length}</p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Audio Ready
                </p>
                <p className="mt-3 text-3xl font-semibold">
                  {models.filter((model) => model.generateAudio).length}
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Top Resolution
                </p>
                <p className="mt-3 text-3xl font-semibold">4K</p>
              </article>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">
                  Selected model
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {selectedModel?.name ?? "Loading"}
                </h2>
              </div>
              {selectedModel ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(
                    job?.status ?? "pending",
                  )}`}
                >
                  {job?.status ?? "ready"}
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              {selectedModel?.description ??
                "Pick a model to inspect its supported durations, aspect ratios, pricing, and generation options."}
            </p>
            {selectedModel ? (
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-[var(--foreground)]">Pricing</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(selectedModel.pricingSkus).map(
                      ([sku, price]) => (
                        <span
                          key={sku}
                          className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]"
                        >
                          {sku}: ${price}
                        </span>
                      ),
                    )}
                    {!Object.keys(selectedModel.pricingSkus).length ? (
                      <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--muted)]">
                        No pricing metadata
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Released
                    </p>
                    <p className="mt-2 font-medium">{formatDate(selectedModel.created)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Capabilities
                    </p>
                    <p className="mt-2 font-medium">
                      {selectedModel.generateAudio ? "Video + audio" : "Video only"}
                      {selectedModel.seed ? " · Seeded" : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          className="space-y-6 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              className="min-h-36 w-full rounded-[1.4rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[color:rgba(191,90,54,0.12)]"
              id="prompt"
              onChange={(event) =>
                setForm((current) => ({ ...current, prompt: event.target.value }))
              }
              placeholder="Describe the shot, camera movement, motion, and style."
              value={form.prompt}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Model</span>
              <select
                className="w-full rounded-[1.1rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)]"
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
              <span>Resolution</span>
              <select
                className="w-full rounded-[1.1rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)]"
                disabled={!selectedModel?.supportedResolutions.length}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    resolution: event.target.value,
                  }))
                }
                value={form.resolution}
              >
                {selectedModel?.supportedResolutions.map((resolution) => (
                  <option key={resolution} value={resolution}>
                    {resolution}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Aspect ratio</span>
              <select
                className="w-full rounded-[1.1rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)]"
                disabled={!selectedModel?.supportedAspectRatios.length}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    aspectRatio: event.target.value,
                  }))
                }
                value={form.aspectRatio}
              >
                {selectedModel?.supportedAspectRatios.map((aspectRatio) => (
                  <option key={aspectRatio} value={aspectRatio}>
                    {aspectRatio}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Duration</span>
              <select
                className="w-full rounded-[1.1rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)]"
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
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2 text-sm font-medium">
              <span>Seed</span>
              <input
                className="w-full rounded-[1.1rem] border border-[var(--border)] bg-white/80 px-4 py-3 outline-none focus:border-[var(--accent)]"
                disabled={!selectedModel?.seed}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((current) => ({ ...current, seed: event.target.value }))
                }
                placeholder={
                  selectedModel?.seed ? "Optional deterministic seed" : "Unsupported"
                }
                value={form.seed}
              />
            </label>

            <label className="flex items-end gap-3 rounded-[1.1rem] border border-[var(--border)] bg-white/70 px-4 py-3 text-sm font-medium">
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
              Generate audio
            </label>
          </div>

          {modelsError ? (
            <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {modelsError}
            </p>
          ) : null}

          {jobError ? (
            <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {jobError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              {isLoadingModels
                ? "Loading current OpenRouter video models..."
                : "Submitting creates an async job and starts live polling."}
            </p>
            <button
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={isLoadingModels || isSubmitting || !form.modelId || !form.prompt.trim()}
              type="submit"
            >
              {isSubmitting ? "Submitting..." : "Generate video"}
            </button>
          </div>
        </form>

        <section className="space-y-6 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Latest generation
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {job ? `Job ${job.id}` : "No job yet"}
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(
                job?.status ?? "pending",
              )}`}
            >
              {job?.status ?? "idle"}
            </span>
          </div>

          <div className="rounded-[1.6rem] border border-dashed border-[var(--border)] bg-white/60 p-4">
            {job?.unsignedUrls[0] ? (
              <video
                className="aspect-video w-full rounded-[1.2rem] bg-[#120d0a] object-cover"
                controls
                src={job.unsignedUrls[0]}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(191,90,54,0.12),rgba(255,255,255,0.8))] p-6 text-center text-sm leading-6 text-[var(--muted)]">
                Generated clips will appear here as soon as OpenRouter marks the
                job complete.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Cost
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatCurrency(job?.usage?.cost)}
              </p>
            </article>
            <article className="rounded-2xl bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Generation ID
              </p>
              <p className="mt-2 truncate text-lg font-semibold">
                {job?.generationId ?? "Pending"}
              </p>
            </article>
          </div>

          {job?.error ? (
            <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {job.error}
            </p>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Supported controls for this model
            </p>
            <div className="flex flex-wrap gap-2">
              {(selectedModel?.allowedPassthroughParameters.length
                ? selectedModel.allowedPassthroughParameters
                : ["No passthrough parameters exposed"]).map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-xs text-[var(--muted)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
