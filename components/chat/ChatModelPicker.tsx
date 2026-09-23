"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ClaudeIcon,
  GeminiIcon,
  GrokIcon,
  ModelPicker,
  OpenAIIcon,
  type ModelCapability,
  type ModelPickerProvider,
} from "@/components/ui/model-picker";
import { cn } from "@/lib/utils";

type ChatModelPickerProps = {
  conversationId: string;
  disabled?: boolean;
};

type ApiModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  isFree?: boolean;
  capabilities?: {
    reasoning?: boolean;
    imageInput?: boolean;
  };
};

type ModelsApiResponse = {
  ok?: boolean;
  models?: ApiModel[];
  message?: string;
  error?: string;
};

type ModelSelectionApiResponse = {
  ok?: boolean;
  selection?: {
    selectedModel?: string;
  };
  message?: string;
  error?: string;
};

const MODELS_FETCH_LIMIT = 2000;
const OPENROUTER_FREE_MODEL_ID = "openrouter/free";
const DEMO_FREE_MODEL_ID = "demo/free";

/** Display names aligned with `/api/models` `getProviderName`. */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  mistralai: "Mistral AI",
  "meta-llama": "Meta",
  qwen: "Qwen",
  "x-ai": "xAI",
  xai: "xAI",
  cohere: "Cohere",
  microsoft: "Microsoft",
  nvidia: "NVIDIA",
  perplexity: "Perplexity",
  openrouter: "OpenRouter",
  demo: "Demo",
};

/**
 * OpenRouter model ids are `provider-slug/model-name`.
 * Always group by that slug so display-name variants cannot collide on React keys.
 */
function openRouterProviderSlug(modelId: string): string {
  const raw = modelId.split("/")[0]?.trim().toLowerCase();
  return raw || "unknown";
}

function providerDisplayName(slug: string, fallback?: string): string {
  if (PROVIDER_DISPLAY_NAMES[slug]) {
    return PROVIDER_DISPLAY_NAMES[slug];
  }
  if (fallback?.trim()) {
    return fallback.trim();
  }
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function providerIcon(slug: string): ReactNode {
  const className = "size-4 shrink-0";
  switch (slug) {
    case "openai":
      return <OpenAIIcon className={className} />;
    case "anthropic":
      return <ClaudeIcon className={className} />;
    case "google":
      return <GeminiIcon className={className} />;
    case "x-ai":
    case "xai":
      return <GrokIcon className={className} />;
    default:
      return null;
  }
}

function mapCapabilities(
  capabilities?: ApiModel["capabilities"],
): readonly ModelCapability[] | undefined {
  if (!capabilities) {
    return undefined;
  }

  const mapped: ModelCapability[] = [];
  if (capabilities.reasoning) {
    mapped.push("reasoning");
  }
  if (capabilities.imageInput) {
    mapped.push("image");
  }

  return mapped.length > 0 ? mapped : undefined;
}

function selectionModeForModel(
  model: ApiModel | undefined,
  modelId: string,
): "auto" | "preset" | "advanced" {
  if (modelId === "openrouter/auto") {
    return "auto";
  }
  if (
    modelId === OPENROUTER_FREE_MODEL_ID ||
    modelId === DEMO_FREE_MODEL_ID ||
    model?.isFree
  ) {
    return "preset";
  }
  return "advanced";
}

function buildProviders(models: ApiModel[]): {
  providers: ModelPickerProvider[];
  modelsById: Map<string, ApiModel>;
} {
  const modelsById = new Map<string, ApiModel>();
  for (const model of models) {
    const id = model.id?.trim();
    if (!id) {
      continue;
    }
    // Last write wins if the catalog ever repeats an id.
    modelsById.set(id, { ...model, id });
  }

  type Bucket = {
    slug: string;
    name: string;
    models: ApiModel[];
  };

  const bySlug = new Map<string, Bucket>();

  for (const model of modelsById.values()) {
    const slug = openRouterProviderSlug(model.id);
    const existing = bySlug.get(slug);
    if (existing) {
      existing.models.push(model);
      continue;
    }
    bySlug.set(slug, {
      slug,
      name: providerDisplayName(slug, model.provider),
      models: [model],
    });
  }

  const providers: ModelPickerProvider[] = [];

  for (const bucket of bySlug.values()) {
    const sorted = [...bucket.models];
    if (bucket.slug === "openrouter") {
      sorted.sort((a, b) => {
        if (a.id === "openrouter/auto") {
          return -1;
        }
        if (b.id === "openrouter/auto") {
          return 1;
        }
        if (a.id === OPENROUTER_FREE_MODEL_ID) {
          return -1;
        }
        if (b.id === OPENROUTER_FREE_MODEL_ID) {
          return 1;
        }
        return a.name.localeCompare(b.name, "en");
      });
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "en"));
    }

    providers.push({
      id: bucket.slug,
      name: bucket.name,
      icon: providerIcon(bucket.slug),
      models: sorted.map((model) => ({
        id: model.id,
        name: model.name,
        description: model.description?.trim() || undefined,
        capabilities: mapCapabilities(model.capabilities),
      })),
    });
  }

  providers.sort((a, b) => {
    if (a.id === "openrouter") {
      return -1;
    }
    if (b.id === "openrouter") {
      return 1;
    }
    return a.name.localeCompare(b.name, "en");
  });

  return { providers, modelsById };
}

export default function ChatModelPicker({
  conversationId,
  disabled = false,
}: ChatModelPickerProps) {
  const [providers, setProviders] = useState<ModelPickerProvider[]>([]);
  const [modelsById, setModelsById] = useState<Map<string, ApiModel>>(
    () => new Map(),
  );
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const pickerLocked = disabled || !conversationId || loading;

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/models?limit=${MODELS_FETCH_LIMIT}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ModelsApiResponse;

        if (!response.ok || !data.ok || !Array.isArray(data.models)) {
          throw new Error(
            data.message || data.error || "Could not load models.",
          );
        }

        if (!cancelled) {
          const built = buildProviders(data.models);
          setProviders(built.providers);
          setModelsById(built.modelsById);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load models.",
          );
          setProviders([]);
          setModelsById(new Map());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setSelectedModel(undefined);
      return;
    }

    let cancelled = false;

    async function loadSelection() {
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/model`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ModelSelectionApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message || data.error || "Could not load model selection.",
          );
        }

        if (!cancelled) {
          setSelectedModel(data.selection?.selectedModel);
        }
      } catch (selectionError) {
        if (!cancelled) {
          console.error("Load conversation model selection:", selectionError);
        }
      }
    }

    void loadSelection();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const handleValueChange = useCallback(
    async (modelId: string) => {
      if (pickerLocked || !conversationId || savingRef.current) {
        return;
      }

      const catalogModel = modelsById.get(modelId);
      const previous = selectedModel;
      setSelectedModel(modelId);
      savingRef.current = true;
      setSaving(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/model`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedModel: modelId,
              modelSelectionMode: selectionModeForModel(catalogModel, modelId),
              modelPreferences: {
                preferFree:
                  modelId === OPENROUTER_FREE_MODEL_ID ||
                  modelId === DEMO_FREE_MODEL_ID ||
                  Boolean(catalogModel?.isFree),
                selectedByUser: true,
              },
            }),
          },
        );

        const data = (await response.json()) as ModelSelectionApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message || data.error || "Could not save model selection.",
          );
        }

        setSelectedModel(data.selection?.selectedModel ?? modelId);
      } catch (saveError) {
        setSelectedModel(previous);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save model selection.",
        );
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [conversationId, modelsById, pickerLocked, selectedModel],
  );

  const statusMessage = useMemo(() => {
    if (loading) {
      return "در حال بارگذاری مدل‌ها…";
    }
    if (saving) {
      return "در حال ذخیره…";
    }
    if (error) {
      return error;
    }
    return null;
  }, [error, loading, saving]);

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <div
        className={cn(
          (pickerLocked || saving) && "pointer-events-none opacity-60",
        )}
      >
        <ModelPicker
          providers={providers}
          value={selectedModel}
          onValueChange={(modelId) => {
            void handleValueChange(modelId);
          }}
          placeholder="انتخاب مدل"
          side="bottom"
          align="end"
          closeOnSelect
          className="ring-2 ring-border bg-[var(--surface)]"
        />
      </div>
      {statusMessage ? (
        <p
          className={cn(
            "max-w-[16rem] truncate text-[11px] leading-tight",
            error ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
          )}
          role={error ? "alert" : "status"}
          title={statusMessage}
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
