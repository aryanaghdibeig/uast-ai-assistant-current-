// lib/assistant/semanticMemory.ts

import {
  createEmbedding,
  normalizeEmbeddingText,
} from "@/lib/assistant/embeddings";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


/* =====================================================
   Types
===================================================== */

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;


export type SemanticMemoryMatch = {
  id:
    string;

  role:
    "user" |
    "assistant" |
    "system";

  content:
    string;

  created_at:
    string;

  similarity:
    number;
};


export type SemanticMemorySearchResult = {
  query:
    string;

  conversationId:
    string;

  source:
    "mock" |
    "openrouter";

  model:
    string;

  dimensions:
    number;

  threshold:
    number;

  requestedCount:
    number;

  rawMatchCount:
    number;

  matchCount:
    number;

  matches:
    SemanticMemoryMatch[];
};


type SearchConversationSemanticMemoryOptions = {
  supabase:
    SupabaseServerClient;

  conversationId:
    string;

  userId:
    string;

  query:
    string;

  matchCount?:
    number;

  threshold?:
    number;
};


/* =====================================================
   Constants
===================================================== */

/**
 * حداکثر تعداد پیام‌های نهایی
 * که وارد Context مدل می‌شوند.
 */
const DEFAULT_MATCH_COUNT =
  6;


const MAX_FINAL_MATCH_COUNT =
  12;


/**
 * تعداد بیشتری از دیتابیس می‌خوانیم
 * تا پیام‌های کم‌ارزش یا تکراری
 * بعداً حذف شوند.
 */
const MAX_RAW_MATCH_COUNT =
  20;


/**
 * سقف متن بازیابی‌شده‌ای
 * که در Prompt قرار می‌گیرد.
 */
const DEFAULT_CONTEXT_CHARACTER_LIMIT =
  6000;


/* =====================================================
   Helpers
===================================================== */

function clampInteger(
  value:
    unknown,

  minimum:
    number,

  maximum:
    number,

  fallback:
    number
) {
  const numericValue =
    typeof value ===
      "number"
      ? value
      : Number(
          value
        );


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return fallback;
  }


  return Math.min(
    maximum,

    Math.max(
      minimum,

      Math.floor(
        numericValue
      )
    )
  );
}


function clampThreshold(
  value:
    unknown,

  fallback:
    number
) {
  const numericValue =
    typeof value ===
      "number"
      ? value
      : Number(
          value
        );


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return fallback;
  }


  return Math.min(
    1,

    Math.max(
      -1,

      numericValue
    )
  );
}


function normalizeComparableText(
  value:
    string
) {
  return normalizeEmbeddingText(
    value
  )
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,

      " "
    )
    .replace(
      /\s+/g,

      " "
    )
    .trim();
}


function createContentPreview(
  value:
    string,

  maxLength =
    700
) {
  const normalized =
    normalizeEmbeddingText(
      value
    );


  if (
    normalized.length <=
    maxLength
  ) {
    return normalized;
  }


  return `${normalized.slice(
    0,

    maxLength
  )}...`;
}


/**
 * پاسخ‌های آزمایشی MOCK_AI
 * معمولاً متن تکراری دارند
 * و ارزش حافظه معنایی کمی دارند.
 *
 * آن‌ها حذف می‌شوند تا پیام‌های
 * واقعی و مفید بالاتر قرار بگیرند.
 */
function isLowValueMockMessage(
  content:
    string
) {
  const normalized =
    normalizeEmbeddingText(
      content
    );


  if (
    normalized.length <
    3
  ) {
    return true;
  }


  return (
    normalized.includes(
      "این یک پاسخ آزمایشی از حالت MOCK_AI است"
    ) ||

    normalized.includes(
      "در حالت MOCK_AI اتصال به OpenRouter انجام نمی‌شود"
    )
  );
}


/**
 * پیام‌های تکراری حذف می‌شوند.
 */
function removeDuplicateMatches(
  matches:
    SemanticMemoryMatch[]
) {
  const seen =
    new Set<
      string
    >();


  const uniqueMatches:
    SemanticMemoryMatch[] =
    [];


  for (
    const match of
      matches
  ) {
    const comparableText =
      normalizeComparableText(
        match.content
      );


    if (
      !comparableText ||
      seen.has(
        comparableText
      )
    ) {
      continue;
    }


    seen.add(
      comparableText
    );


    uniqueMatches.push(
      match
    );
  }


  return uniqueMatches;
}


/* =====================================================
   Semantic search
===================================================== */

export async function searchConversationSemanticMemory(
  options:
    SearchConversationSemanticMemoryOptions
):
  Promise<
    SemanticMemorySearchResult
  > {
  const normalizedQuery =
    normalizeEmbeddingText(
      options.query
    );


  if (
    !normalizedQuery
  ) {
    throw new Error(
      "Semantic-search query cannot be empty."
    );
  }


  const requestedCount =
    clampInteger(
      options.matchCount,

      1,

      MAX_FINAL_MATCH_COUNT,

      DEFAULT_MATCH_COUNT
    );


  /**
   * ابتدا پرسش جدید کاربر
   * به Embedding تبدیل می‌شود.
   */
  const queryEmbedding =
    await createEmbedding(
      normalizedQuery,

      {
        inputType:
          "search_query",
      }
    );


  /**
   * در حالت Mock،
   * بردارها آزمایشی هستند؛
   * بنابراین آستانه پایین‌تری
   * استفاده می‌کنیم.
   *
   * هنگام استفاده از مدل واقعی،
   * آستانه سخت‌گیرانه‌تر می‌شود.
   */
  const defaultThreshold =
    queryEmbedding.source ===
      "mock"
      ? 0.02
      : 0.35;


  const threshold =
    clampThreshold(
      options.threshold,

      defaultThreshold
    );


  /**
   * تعداد بیشتری از دیتابیس
   * درخواست می‌کنیم تا پس از
   * حذف پیام‌های Mock و تکراری،
   * نتیجه کافی باقی بماند.
   */
  const rawMatchCount =
    Math.min(
      MAX_RAW_MATCH_COUNT,

      Math.max(
        requestedCount * 3,

        10
      )
    );


  const {
    data,

    error,
  } =
    await options
      .supabase
      .rpc(
        "match_conversation_messages",

        {
          query_embedding:
            queryEmbedding
              .embedding,

          target_conversation_id:
            options
              .conversationId,

          target_user_id:
            options
              .userId,

          match_threshold:
            threshold,

          match_count:
            rawMatchCount,
        }
      );


  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }


  const rawMatches =
    (
      data ||
      []
    ) as
      SemanticMemoryMatch[];


  const cleanedMatches =
    removeDuplicateMatches(
      rawMatches
        .filter(
          (
            match
          ) =>
            Boolean(
              match.id
            ) &&

            Boolean(
              normalizeEmbeddingText(
                match.content
              )
            ) &&

            !isLowValueMockMessage(
              match.content
            )
        )
        .map(
          (
            match
          ) => ({
            ...match,

            similarity:
              Number(
                Number(
                  match.similarity ||
                  0
                ).toFixed(
                  6
                )
              ),

            content:
              createContentPreview(
                match.content
              ),
          })
        )
    )
      .slice(
        0,

        requestedCount
      );


  return {
    query:
      normalizedQuery,

    conversationId:
      options
        .conversationId,

    source:
      queryEmbedding
        .source,

    model:
      queryEmbedding
        .model,

    dimensions:
      queryEmbedding
        .dimensions,

    threshold,

    requestedCount,

    rawMatchCount:
      rawMatches.length,

    matchCount:
      cleanedMatches.length,

    matches:
      cleanedMatches,
  };
}


/* =====================================================
   Build prompt context
===================================================== */

export function buildSemanticMemoryContext(
  matches:
    SemanticMemoryMatch[],

  characterLimit =
    DEFAULT_CONTEXT_CHARACTER_LIMIT
) {
  if (
    !Array.isArray(
      matches
    ) ||

    matches.length ===
    0
  ) {
    return "";
  }


  const safeCharacterLimit =
    clampInteger(
      characterLimit,

      1000,

      12000,

      DEFAULT_CONTEXT_CHARACTER_LIMIT
    );


  const contextParts:
    string[] =
    [];


  let currentLength =
    0;


  for (
    let index =
      0;

    index <
    matches.length;

    index++
  ) {
    const match =
      matches[
        index
      ];


    const roleLabel =
      match.role ===
        "user"
        ? "کاربر"
        : match.role ===
            "assistant"
          ? "دستیار"
          : "سیستم";


    const similarityPercent =
      Math.round(
        match.similarity *
        100
      );


    const part =
      `${index + 1}. پیام مرتبط قبلی — ${roleLabel} — شباهت تقریبی ${similarityPercent}٪

${createContentPreview(
  match.content,

  900
)}`;


    if (
      currentLength +
        part.length >
      safeCharacterLimit
    ) {
      break;
    }


    contextParts.push(
      part
    );


    currentLength +=
      part.length;
  }


  if (
    contextParts.length ===
    0
  ) {
    return "";
  }


  return `
حافظه معنایی بازیابی‌شده از پیام‌های قدیمی همین گفتگو:

${contextParts.join(
  "\n\n"
)}

قواعد استفاده از حافظه معنایی:

- این پیام‌ها فقط سوابق مرتبط احتمالی هستند؛ از آن‌ها فقط زمانی استفاده کن که واقعاً با درخواست فعلی ارتباط داشته باشند.

- درخواست جدید و صریح کاربر همیشه بر اطلاعات قدیمی اولویت دارد.

- اگر بین حافظه قدیمی و درخواست فعلی تعارض وجود داشت، درخواست فعلی را مبنا قرار بده.

- اطلاعات نامطمئن را به‌عنوان واقعیت قطعی بیان نکن.

- حافظه را بی‌دلیل برای کاربر بازگو نکن؛ از آن برای حفظ پیوستگی و دقت پاسخ استفاده کن.
`.trim();
}