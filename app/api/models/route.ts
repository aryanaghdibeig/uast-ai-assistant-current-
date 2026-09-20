// app/api/models/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


/* =====================================================
   OpenRouter types
===================================================== */

type OpenRouterArchitecture = {
  modality?:
    string;

  input_modalities?:
    string[];

  output_modalities?:
    string[];

  tokenizer?:
    string;

  instruct_type?:
    string | null;
};


type OpenRouterPricing = {
  prompt?:
    string;

  completion?:
    string;

  request?:
    string;

  image?:
    string;

  audio?:
    string;

  internal_reasoning?:
    string;

  input_cache_read?:
    string;

  input_cache_write?:
    string;
};


type OpenRouterTopProvider = {
  context_length?:
    number | null;

  max_completion_tokens?:
    number | null;

  is_moderated?:
    boolean;
};


type OpenRouterModel = {
  id:
    string;

  canonical_slug?:
    string;

  name?:
    string;

  description?:
    string;

  created?:
    number;

  context_length?:
    number | null;

  architecture?:
    OpenRouterArchitecture;

  pricing?:
    OpenRouterPricing;

  top_provider?:
    OpenRouterTopProvider;

  supported_parameters?:
    string[];

  expiration_date?:
    string | null;

  knowledge_cutoff?:
    string | null;
};


type OpenRouterModelsResponse = {
  data?:
    OpenRouterModel[];

  error?: {
    code?:
      string | number;

    message?:
      string;
  };
};


/* =====================================================
   Application model type
===================================================== */

type ModelSelectionMode =
  | "auto"
  | "preset"
  | "advanced";


type AppModel = {
  id:
    string;

  name:
    string;

  provider:
    string;

  description:
    string;

  contextLength:
    number | null;

  maxCompletionTokens:
    number | null;

  promptPricePerMillion:
    number | null;

  completionPricePerMillion:
    number | null;

  isFree:
    boolean;

  isRouter:
    boolean;

  selectionMode:
    ModelSelectionMode;

  capabilities: {
    text:
      boolean;

    imageInput:
      boolean;

    audioInput:
      boolean;

    tools:
      boolean;

    reasoning:
      boolean;

    structuredOutput:
      boolean;
  };

  supportedParameters:
    string[];

  createdAt:
    string | null;

  knowledgeCutoff:
    string | null;
};


/* =====================================================
   Constants
===================================================== */

const DEFAULT_MODEL_LIMIT =
  80;


const MAX_MODEL_LIMIT =
  150;


const ALLOWED_SORT_VALUES =
  new Set([
    "most-popular",

    "top-weekly",

    "newest",

    "pricing-low-to-high",

    "pricing-high-to-low",

    "context-high-to-low",

    "throughput-high-to-low",

    "latency-low-to-high",

    "intelligence-high-to-low",
  ]);


/**
 * این دو Router را خودمان
 * به ابتدای فهرست اضافه می‌کنیم.
 */
const ROUTER_MODELS:
  AppModel[] = [
  {
    id:
      "openrouter/auto",

    name:
      "انتخاب هوشمند OpenRouter",

    provider:
      "OpenRouter",

    description:
      "انتخاب خودکار مدل متناسب با نوع، پیچیدگی و نیاز درخواست.",

    contextLength:
      null,

    maxCompletionTokens:
      null,

    promptPricePerMillion:
      null,

    completionPricePerMillion:
      null,

    isFree:
      false,

    isRouter:
      true,

    selectionMode:
      "auto",

    capabilities: {
      text:
        true,

      imageInput:
        true,

      audioInput:
        false,

      tools:
        true,

      reasoning:
        true,

      structuredOutput:
        true,
    },

    supportedParameters:
      [],

    createdAt:
      null,

    knowledgeCutoff:
      null,
  },

  {
    id:
      "openrouter/free",

    name:
      "مدل رایگان خودکار",

    provider:
      "OpenRouter",

    description:
      "انتخاب خودکار یکی از مدل‌های رایگان سازگار و در دسترس.",

    contextLength:
      null,

    maxCompletionTokens:
      null,

    promptPricePerMillion:
      0,

    completionPricePerMillion:
      0,

    isFree:
      true,

    isRouter:
      true,

    selectionMode:
      "preset",

    capabilities: {
      text:
        true,

      imageInput:
        false,

      audioInput:
        false,

      tools:
        false,

      reasoning:
        false,

      structuredOutput:
        false,
    },

    supportedParameters:
      [],

    createdAt:
      null,

    knowledgeCutoff:
      null,
  },
];


/* =====================================================
   Number helpers
===================================================== */

function toFiniteNumber(
  value:
    unknown
):
  number | null {
  const numericValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return null;
  }


  return numericValue;
}


function toPositiveInteger(
  value:
    unknown
):
  number | null {
  const numericValue =
    toFiniteNumber(
      value
    );


  if (
    numericValue ===
      null ||

    numericValue <
      0
  ) {
    return null;
  }


  return Math.floor(
    numericValue
  );
}


/**
 * قیمت OpenRouter در Metadata
 * به‌صورت هزینه هر Token است.
 *
 * برای رابط کاربری آن را
 * به هزینه هر یک میلیون Token
 * تبدیل می‌کنیم.
 */
function toPricePerMillion(
  value:
    unknown
):
  number | null {
  const numericValue =
    toFiniteNumber(
      value
    );


  if (
    numericValue ===
      null ||

    numericValue <
      0
  ) {
    return null;
  }


  return Number(
    (
      numericValue *
      1_000_000
    ).toFixed(
      6
    )
  );
}


/* =====================================================
   Request helpers
===================================================== */

function clampLimit(
  value:
    unknown
) {
  const numericValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return DEFAULT_MODEL_LIMIT;
  }


  return Math.min(
    MAX_MODEL_LIMIT,

    Math.max(
      1,

      Math.floor(
        numericValue
      )
    )
  );
}


function getSafeSort(
  value:
    string | null
) {
  if (
    value &&

    ALLOWED_SORT_VALUES.has(
      value
    )
  ) {
    return value;
  }


  return "most-popular";
}


/* =====================================================
   Provider helpers
===================================================== */

function formatProviderWord(
  value:
    string
) {
  return value
    .split(
      "-"
    )
    .filter(
      Boolean
    )
    .map(
      (
        part
      ) =>
        part
          .charAt(
            0
          )
          .toUpperCase() +

        part.slice(
          1
        )
    )
    .join(
      " "
    );
}


function getProviderName(
  modelId:
    string
) {
  const providerSlug =
    modelId
      .split(
        "/"
      )[0]
      ?.trim();


  if (
    !providerSlug
  ) {
    return "Unknown";
  }


  const knownProviders:
    Record<
      string,
      string
    > = {
    openai:
      "OpenAI",

    anthropic:
      "Anthropic",

    google:
      "Google",

    deepseek:
      "DeepSeek",

    mistralai:
      "Mistral AI",

    "meta-llama":
      "Meta",

    qwen:
      "Qwen",

    "x-ai":
      "xAI",

    cohere:
      "Cohere",

    microsoft:
      "Microsoft",

    nvidia:
      "NVIDIA",

    perplexity:
      "Perplexity",

    openrouter:
      "OpenRouter",
  };


  return (
    knownProviders[
      providerSlug
    ] ||

    formatProviderWord(
      providerSlug
    )
  );
}


/* =====================================================
   Capability helpers
===================================================== */

function hasSupportedParameter(
  parameters:
    string[],

  candidates:
    string[]
) {
  return candidates.some(
    (
      candidate
    ) =>
      parameters.includes(
        candidate
      )
  );
}


function getCapabilities(
  model:
    OpenRouterModel
) {
  const inputModalities =
    Array.isArray(
      model
        .architecture
        ?.input_modalities
    )
      ? model
          .architecture
          ?.input_modalities ||

        []
      : [];


  const outputModalities =
    Array.isArray(
      model
        .architecture
        ?.output_modalities
    )
      ? model
          .architecture
          ?.output_modalities ||

        []
      : [];


  const parameters =
    Array.isArray(
      model
        .supported_parameters
    )
      ? model
          .supported_parameters ||

        []
      : [];


  return {
    text:
      outputModalities.length ===
        0 ||

      outputModalities.includes(
        "text"
      ),


    imageInput:
      inputModalities.includes(
        "image"
      ),


    audioInput:
      inputModalities.includes(
        "audio"
      ),


    tools:
      hasSupportedParameter(
        parameters,

        [
          "tools",

          "tool_choice",

          "parallel_tool_calls",
        ]
      ),


    reasoning:
      hasSupportedParameter(
        parameters,

        [
          "reasoning",

          "include_reasoning",

          "reasoning_effort",
        ]
      ),


    structuredOutput:
      hasSupportedParameter(
        parameters,

        [
          "response_format",

          "structured_outputs",
        ]
      ),
  };
}


/* =====================================================
   Model normalization
===================================================== */

function normalizeModel(
  model:
    OpenRouterModel
):
  AppModel | null {
  const id =
    typeof model.id ===
      "string"
      ? model
          .id
          .trim()
      : "";


  if (
    !id
  ) {
    return null;
  }


  const capabilities =
    getCapabilities(
      model
    );


  /**
   * فقط مدل‌هایی که خروجی متن
   * دارند در انتخاب‌گر چت نمایش
   * داده می‌شوند.
   */
  if (
    !capabilities.text
  ) {
    return null;
  }


  const promptPrice =
    toPricePerMillion(
      model
        .pricing
        ?.prompt
    );


  const completionPrice =
    toPricePerMillion(
      model
        .pricing
        ?.completion
    );


  const isFree =
    promptPrice ===
      0 &&

    completionPrice ===
      0;


  const createdTimestamp =
    toPositiveInteger(
      model.created
    );


  return {
    id,


    name:
      typeof model.name ===
        "string" &&

      model.name.trim()
        ? model
            .name
            .trim()
        : id,


    provider:
      getProviderName(
        id
      ),


    description:
      typeof model.description ===
        "string"
        ? model
            .description
            .trim()
        : "",


    contextLength:
      toPositiveInteger(
        model
          .context_length
      ),


    maxCompletionTokens:
      toPositiveInteger(
        model
          .top_provider
          ?.max_completion_tokens
      ),


    promptPricePerMillion:
      promptPrice,


    completionPricePerMillion:
      completionPrice,


    isFree,


    isRouter:
      false,


    selectionMode:
      "advanced",


    capabilities,


    supportedParameters:
      Array.isArray(
        model
          .supported_parameters
      )
        ? model
            .supported_parameters ||

          []
        : [],


    createdAt:
      createdTimestamp ===
        null
        ? null
        : new Date(
            createdTimestamp *
            1000
          )
            .toISOString(),


    knowledgeCutoff:
      typeof model
        .knowledge_cutoff ===
        "string"
        ? model
            .knowledge_cutoff
        : null,
  };
}


/* =====================================================
   Search helpers
===================================================== */

function normalizeSearchText(
  value:
    string
) {
  return value
    .normalize(
      "NFKC"
    )
    .replace(
      /\s+/g,

      " "
    )
    .trim()
    .toLowerCase();
}


function modelMatchesSearch(
  model:
    AppModel,

  search:
    string
) {
  if (
    !search
  ) {
    return true;
  }


  const searchableText =
    normalizeSearchText(
      [
        model.id,

        model.name,

        model.provider,

        model.description,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )
    );


  return searchableText.includes(
    search
  );
}


/* =====================================================
   OpenRouter request
===================================================== */

async function loadOpenRouterModels(
  sort:
    string
) {
  const apiKey =
    process.env
      .OPENROUTER_API_KEY
      ?.trim();


  if (
    !apiKey
  ) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }


  const url =
    new URL(
      "https://openrouter.ai/api/v1/models"
    );


  url.searchParams.set(
    "output_modalities",

    "text"
  );


  url.searchParams.set(
    "sort",

    sort
  );


  const response =
    await fetch(
      url.toString(),

      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const responseData =
    await response
      .json()
      .catch(
        () => ({})
      ) as
      OpenRouterModelsResponse;


  if (
    !response.ok
  ) {
    throw new Error(
      responseData
        .error
        ?.message ||

      `OpenRouter models request failed with status ${response.status}.`
    );
  }


  if (
    !Array.isArray(
      responseData.data
    )
  ) {
    throw new Error(
      "OpenRouter models response does not contain a model list."
    );
  }


  return responseData
    .data;
}


/* =====================================================
   GET /api/models
===================================================== */

export async function GET(
  request:
    NextRequest
) {
  try {
    /* -------------------------------------------------
       1. Authentication
    -------------------------------------------------- */

    const auth =
      await requireUser({
        unauthorizedFormat:
          "json",
      });


    if (
      !auth.ok
    ) {
      return auth.response;
    }


    /* -------------------------------------------------
       2. Query settings
    -------------------------------------------------- */

    const search =
      normalizeSearchText(
        request
          .nextUrl
          .searchParams
          .get(
            "q"
          ) ||

        ""
      );


    const limit =
      clampLimit(
        request
          .nextUrl
          .searchParams
          .get(
            "limit"
          )
      );


    const freeOnly =
      request
        .nextUrl
        .searchParams
        .get(
          "freeOnly"
        ) ===
      "true";


    const visionOnly =
      request
        .nextUrl
        .searchParams
        .get(
          "visionOnly"
        ) ===
      "true";


    const sort =
      getSafeSort(
        request
          .nextUrl
          .searchParams
          .get(
            "sort"
          )
      );


    /* -------------------------------------------------
       3. OpenRouter models
    -------------------------------------------------- */

    const rawModels =
      await loadOpenRouterModels(
        sort
      );


    /* -------------------------------------------------
       4. Normalize and filter
    -------------------------------------------------- */

    const dynamicModels =
      rawModels
        .map(
          normalizeModel
        )
        .filter(
          (
            model
          ):
            model is
              AppModel =>
            Boolean(
              model
            )
        );


    /**
     * جلوگیری از تکرار شناسه‌ها
     */
    const uniqueModels =
      new Map<
        string,
        AppModel
      >();


    for (
      const model of
        [
          ...ROUTER_MODELS,

          ...dynamicModels,
        ]
    ) {
      if (
        !uniqueModels.has(
          model.id
        )
      ) {
        uniqueModels.set(
          model.id,

          model
        );
      }
    }


    const filteredModels =
      Array
        .from(
          uniqueModels.values()
        )
        .filter(
          (
            model
          ) =>
            modelMatchesSearch(
              model,

              search
            )
        )
        .filter(
          (
            model
          ) =>
            !freeOnly ||

            model.isFree
        )
        .filter(
          (
            model
          ) =>
            !visionOnly ||

            model
              .capabilities
              .imageInput
        )
        .slice(
          0,

          limit
        );


    /* -------------------------------------------------
       5. Response
    -------------------------------------------------- */

    return NextResponse.json({
      ok:
        true,


      message:
        "OpenRouter models were loaded successfully.",


      source:
        "openrouter",


      defaultModel:
        "openrouter/auto",


      filters: {
        search,

        freeOnly,

        visionOnly,

        sort,

        limit,
      },


      count:
        filteredModels.length,


      totalAvailable:
        dynamicModels.length,


      loadedAt:
        new Date()
          .toISOString(),


      models:
        filteredModels,
    });
  } catch (
    error
  ) {
    console.error(
      "Load OpenRouter models error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load OpenRouter models.",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown error",
      },

      {
        status:
          500,
      }
    );
  }
}