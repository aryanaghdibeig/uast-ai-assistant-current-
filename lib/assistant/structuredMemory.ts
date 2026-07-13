// lib/assistant/structuredMemory.ts

import { createHash } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ConversationBehaviorProfile,
} from "@/lib/assistant/memory";

export type StructuredMemoryType =
  | "topic"
  | "fact"
  | "goal"
  | "decision"
  | "constraint"
  | "number"
  | "deadline"
  | "preference"
  | "instruction"
  | "open_task"
  | "entity"
  | "reference"
  | "outcome";

export type StructuredMemoryStatus =
  | "active"
  | "resolved"
  | "superseded"
  | "archived";

export type StructuredMemoryMessage = {
  id: string;

  role:
    | "user"
    | "assistant"
    | "system";

  content: string;

  createdAt?: string;
};

export type StructuredMemoryCandidate = {
  memoryType:
    StructuredMemoryType;

  memoryKey:
    string;

  title:
    string;

  content:
    string;

  valueJson:
    Record<
      string,
      unknown
    >;

  importance:
    number;

  confidence:
    number;

  status:
    StructuredMemoryStatus;

  isPinned:
    boolean;

  sourceMessageIds:
    string[];
};

export type StructuredMemoryRecord = {
  id:
    string;

  memory_type:
    StructuredMemoryType;

  memory_key:
    string;

  title:
    string;

  content:
    string;

  value_json:
    Record<
      string,
      unknown
    >;

  importance:
    number;

  confidence:
    number;

  status:
    StructuredMemoryStatus;

  is_pinned:
    boolean;

  source_message_ids:
    string[];

  first_seen_at:
    string;

  last_confirmed_at:
    string;

  created_at:
    string;

  updated_at:
    string;
};

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;

type ExtractStructuredMemoryInput = {
  conversationTitle:
    string;

  assistantMode:
    string;

  summary:
    string;

  behaviorProfile:
    ConversationBehaviorProfile;

  messages:
    StructuredMemoryMessage[];
};

type SaveStructuredMemoryInput = {
  supabase:
    SupabaseServerClient;

  conversationId:
    string;

  userId:
    string;

  candidates:
    StructuredMemoryCandidate[];
};

type ListStructuredMemoryInput = {
  supabase:
    SupabaseServerClient;

  conversationId:
    string;

  userId:
    string;

  limit?:
    number;
};

const MAX_MEMORY_ITEMS_PER_REFRESH =
  40;

const MAX_SOURCE_MESSAGE_IDS =
  50;

const TYPE_LABELS:
  Record<
    StructuredMemoryType,
    string
  > = {
  topic:
    "موضوع",

  fact:
    "واقعیت",

  goal:
    "هدف",

  decision:
    "تصمیم",

  constraint:
    "محدودیت",

  number:
    "عدد یا مقدار مهم",

  deadline:
    "زمان یا مهلت",

  preference:
    "ترجیح کاربر",

  instruction:
    "دستور پایدار",

  open_task:
    "کار باز",

  entity:
    "موجودیت مهم",

  reference:
    "مرجع",

  outcome:
    "نتیجه",
};

function normalizeDigits(
  value:
    string
) {
  const digitMap:
    Record<
      string,
      string
    > = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",

    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };

  return value.replace(
    /[۰-۹٠-٩]/g,

    (
      digit
    ) =>
      digitMap[
        digit
      ] ||
      digit
  );
}

function normalizeText(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return normalizeDigits(
    value
  )
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /ي/g,
      "ی"
    )
    .replace(
      /ك/g,
      "ک"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function clampText(
  value:
    unknown,

  maxLength:
    number
) {
  const cleanValue =
    normalizeText(
      value
    );

  if (
    cleanValue.length <=
    maxLength
  ) {
    return cleanValue;
  }

  return `${cleanValue.slice(
    0,
    maxLength
  )}...`;
}

function clampNumber(
  value:
    unknown,

  minimum:
    number,

  maximum:
    number,

  fallback:
    number
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    return fallback;
  }

  return Math.min(
    maximum,

    Math.max(
      minimum,
      value
    )
  );
}

function buildStableMemoryKey(
  memoryType:
    StructuredMemoryType,

  seed:
    string
) {
  const normalizedSeed =
    normalizeText(
      seed
    ).toLowerCase();

  const slug =
    normalizedSeed
      .replace(
        /[^\p{L}\p{N}]+/gu,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        52
      ) ||
    "memory";

  const hash =
    createHash(
      "sha256"
    )
      .update(
        `${memoryType}:${normalizedSeed}`
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        12
      );

  return `${memoryType}:${slug}:${hash}`;
}

function splitSentences(
  value:
    string
) {
  const normalized =
    normalizeText(
      value
    );

  if (
    !normalized
  ) {
    return [];
  }

  return normalized
    .replace(
      /([.!؟؛])/g,
      "$1\n"
    )
    .split(
      /\n+/g
    )
    .map(
      (
        item
      ) =>
        normalizeText(
          item
        )
    )
    .filter(
      (
        item
      ) =>
        item.length >=
          8 &&
        item.length <=
          700
    );
}

function includesAny(
  value:
    string,

  patterns:
    string[]
) {
  return patterns.some(
    (
      pattern
    ) =>
      value.includes(
        pattern
      )
  );
}

function uniqueStrings(
  values:
    string[],

  limit:
    number
) {
  return Array
    .from(
      new Set(
        values.filter(
          Boolean
        )
      )
    )
    .slice(
      0,
      limit
    );
}

function normalizeValueJson(
  value:
    unknown
):
  Record<
    string,
    unknown
  > {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  return value as
    Record<
      string,
      unknown
    >;
}

function createCandidate(
  input:
    Partial<
      StructuredMemoryCandidate
    > & {
      memoryType:
        StructuredMemoryType;

      seed:
        string;

      content:
        string;
    }
):
  StructuredMemoryCandidate {
  const content =
    clampText(
      input.content,
      900
    );

  return {
    memoryType:
      input.memoryType,

    memoryKey:
      input.memoryKey ||
      buildStableMemoryKey(
        input.memoryType,

        input.seed
      ),

    title:
      clampText(
        input.title ||
          TYPE_LABELS[
            input.memoryType
          ],

        140
      ),

    content,

    valueJson:
      normalizeValueJson(
        input.valueJson
      ),

    importance:
      Math.round(
        clampNumber(
          input.importance,
          1,
          5,
          3
        )
      ),

    confidence:
      Number(
        clampNumber(
          input.confidence,
          0,
          1,
          0.8
        ).toFixed(
          3
        )
      ),

    status:
      input.status ||
      "active",

    isPinned:
      input.isPinned ||
      false,

    sourceMessageIds:
      uniqueStrings(
        input
          .sourceMessageIds ||
          [],

        MAX_SOURCE_MESSAGE_IDS
      ),
  };
}

function getBehaviorProfileCandidates(
  profile:
    ConversationBehaviorProfile,

  sourceMessageIds:
    string[]
) {
  const candidates:
    StructuredMemoryCandidate[] =
    [];

  if (
    profile.preferredTone
  ) {
    candidates.push(
      createCandidate({
        memoryType:
          "preference",

        seed:
          "preferred-tone",

        memoryKey:
          "preference:preferred-tone",

        title:
          "لحن ترجیحی",

        content:
          `لحن ترجیحی کاربر: ${profile.preferredTone}`,

        valueJson: {
          preferredTone:
            profile.preferredTone,
        },

        importance:
          4,

        confidence:
          0.92,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  if (
    profile.detailLevel
  ) {
    candidates.push(
      createCandidate({
        memoryType:
          "preference",

        seed:
          "detail-level",

        memoryKey:
          "preference:detail-level",

        title:
          "سطح جزئیات ترجیحی",

        content:
          `سطح جزئیات مورد انتظار کاربر: ${profile.detailLevel}`,

        valueJson: {
          detailLevel:
            profile.detailLevel,
        },

        importance:
          4,

        confidence:
          0.9,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  if (
    profile.workingStyle
  ) {
    candidates.push(
      createCandidate({
        memoryType:
          "preference",

        seed:
          "working-style",

        memoryKey:
          "preference:working-style",

        title:
          "سبک همکاری",

        content:
          `سبک همکاری ترجیحی کاربر: ${profile.workingStyle}`,

        valueJson: {
          workingStyle:
            profile.workingStyle,
        },

        importance:
          4,

        confidence:
          0.9,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  const preferredFormats =
    Array.isArray(
      profile.preferredFormats
    )
      ? profile
          .preferredFormats
          .map(
            normalizeText
          )
          .filter(
            Boolean
          )
      : [];

  for (
    const format of
      preferredFormats
  ) {
    candidates.push(
      createCandidate({
        memoryType:
          "preference",

        seed:
          `preferred-format-${format}`,

        memoryKey:
          buildStableMemoryKey(
            "preference",

            `preferred-format-${format}`
          ),

        title:
          "قالب ترجیحی پاسخ",

        content:
          `کاربر قالب «${format}» را برای پاسخ ترجیح می‌دهد.`,

        valueJson: {
          format,
        },

        importance:
          4,

        confidence:
          0.9,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  const workingPreferences =
    Array.isArray(
      profile.workingPreferences
    )
      ? profile
          .workingPreferences
          .map(
            normalizeText
          )
          .filter(
            Boolean
          )
      : [];

  for (
    const preference of
      workingPreferences
  ) {
    candidates.push(
      createCandidate({
        memoryType:
          "preference",

        seed:
          `working-preference-${preference}`,

        title:
          "ترجیح کاری",

        content:
          preference,

        valueJson: {
          preference,
        },

        importance:
          4,

        confidence:
          0.9,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  return candidates;
}

function getSentenceCandidate(
  sentence:
    string,

  messageId:
    string
):
  StructuredMemoryCandidate[] {
  const result:
    StructuredMemoryCandidate[] =
    [];

  const normalized =
    normalizeText(
      sentence
    );

  if (
    !normalized
  ) {
    return result;
  }

  const sourceMessageIds =
    messageId
      ? [
          messageId,
        ]
      : [];

  const goalPatterns = [
    "می‌خواهم",
    "میخواهم",
    "می‌خواهیم",
    "میخواهیم",
    "هدف این است",
    "هدف ما",
    "قصد دارم",
    "قصد داریم",
  ];

  const decisionPatterns = [
    "تصمیم گرفتیم",
    "تصمیم گرفته شد",
    "قرار شد",
    "نهایی شد",
    "انتخاب شد",
    "توافق شد",
    "مصوب شد",
  ];

  const constraintPatterns = [
    "محدودیت",
    "نباید",
    "امکان ندارد",
    "امکان ندار",
    "نمی‌توان",
    "نمی توان",
    "ممنوع",
    "فقط باید",
  ];

  const deadlinePatterns = [
    "تا پایان",
    "مهلت",
    "تاریخ",
    "تا روز",
    "تا ماه",
    "تا سال",
    "موعد",
  ];

  const openTaskPatterns = [
    "باید انجام شود",
    "باید انجام دهیم",
    "مرحله بعد",
    "گام بعد",
    "باقی مانده",
    "هنوز انجام نشده",
    "ادامه دهیم",
    "ادامه بده",
  ];

  const instructionPatterns = [
    "از این به بعد",
    "همیشه",
    "هر بار",
    "فراموش نکن",
    "توجه داشته باش",
    "می‌خواهم پاسخ",
    "میخواهم پاسخ",
    "کد کامل",
    "تکه‌تکه",
    "تکه تکه",
  ];

  const outcomePatterns = [
    "انجام شد",
    "کامل شد",
    "تکمیل شد",
    "موفق شد",
    "درست شد",
    "نهایی شد",
  ];

  const referencePatterns = [
    "شماره نامه",
    "شماره‌نامه",
    "شماره مصوبه",
    "مصوبه",
    "کد ",
    "شناسه",
    "ردیف",
  ];

  if (
    includesAny(
      normalized,

      goalPatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "goal",

        seed:
          normalized,

        title:
          "هدف کاربر",

        content:
          normalized,

        importance:
          5,

        confidence:
          0.92,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      decisionPatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "decision",

        seed:
          normalized,

        title:
          "تصمیم ثبت‌شده",

        content:
          normalized,

        importance:
          5,

        confidence:
          0.93,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      constraintPatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "constraint",

        seed:
          normalized,

        title:
          "محدودیت یا قاعده",

        content:
          normalized,

        importance:
          5,

        confidence:
          0.9,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      deadlinePatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "deadline",

        seed:
          normalized,

        title:
          "زمان یا مهلت مهم",

        content:
          normalized,

        importance:
          5,

        confidence:
          0.85,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      openTaskPatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "open_task",

        seed:
          normalized,

        title:
          "کار یا گام باز",

        content:
          normalized,

        importance:
          4,

        confidence:
          0.88,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      instructionPatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "instruction",

        seed:
          normalized,

        title:
          "دستور پایدار کاربر",

        content:
          normalized,

        importance:
          5,

        confidence:
          0.94,

        isPinned:
          true,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      outcomePatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "outcome",

        seed:
          normalized,

        title:
          "نتیجه ثبت‌شده",

        content:
          normalized,

        importance:
          4,

        confidence:
          0.85,

        sourceMessageIds,
      })
    );
  }

  if (
    includesAny(
      normalized,

      referencePatterns
    )
  ) {
    result.push(
      createCandidate({
        memoryType:
          "reference",

        seed:
          normalized,

        title:
          "مرجع یا شناسه مهم",

        content:
          normalized,

        importance:
          4,

        confidence:
          0.82,

        sourceMessageIds,
      })
    );
  }

  const numbers =
    normalized.match(
      /\d+(?:[./,%\-]\d+)*/g
    ) ||
    [];

  const hasMeaningfulNumberContext =
    includesAny(
      normalized,

      [
        "تعداد",
        "حداقل",
        "حداکثر",
        "درصد",
        "نفر",
        "روز",
        "ماه",
        "سال",
        "ساعت",
        "صفحه",
        "گیگابایت",
        "میلیون",
        "میلیارد",
        "پروژه",
        "کارگاه",
        "شاخص",
        "ردیف",
        "امتیاز",
        "وزن",
        "هدف",
      ]
    );

  if (
    numbers.length >
      0 &&
    hasMeaningfulNumberContext
  ) {
    result.push(
      createCandidate({
        memoryType:
          "number",

        seed:
          normalized,

        title:
          "عدد یا مقدار مهم",

        content:
          normalized,

        valueJson: {
          values:
            uniqueStrings(
              numbers,

              12
            ),
        },

        importance:
          5,

        confidence:
          0.88,

        sourceMessageIds,
      })
    );
  }

  return result;
}

export function extractStructuredMemoryCandidates(
  input:
    ExtractStructuredMemoryInput
) {
  const candidateMap =
    new Map<
      string,
      StructuredMemoryCandidate
    >();

  const addCandidate =
    (
      candidate:
        StructuredMemoryCandidate
    ) => {
      const existing =
        candidateMap.get(
          candidate.memoryKey
        );

      if (
        !existing
      ) {
        candidateMap.set(
          candidate.memoryKey,

          candidate
        );

        return;
      }

      candidateMap.set(
        candidate.memoryKey,

        {
          ...existing,

          ...candidate,

          importance:
            Math.max(
              existing.importance,

              candidate.importance
            ),

          confidence:
            Math.max(
              existing.confidence,

              candidate.confidence
            ),

          isPinned:
            existing.isPinned ||
            candidate.isPinned,

          sourceMessageIds:
            uniqueStrings(
              [
                ...existing
                  .sourceMessageIds,

                ...candidate
                  .sourceMessageIds,
              ],

              MAX_SOURCE_MESSAGE_IDS
            ),
        }
      );
    };

  const userMessages =
    input.messages.filter(
      (
        message
      ) =>
        message.role ===
        "user"
    );

  const recentUserMessageIds =
    uniqueStrings(
      userMessages
        .slice(
          -12
        )
        .map(
          (
            message
          ) =>
            message.id
        ),

      MAX_SOURCE_MESSAGE_IDS
    );

  const conversationTitle =
    normalizeText(
      input.conversationTitle
    );

  if (
    conversationTitle &&
    conversationTitle !==
      "گفتگوی جدید" &&
    conversationTitle !==
      "گفتگوی فایل"
  ) {
    addCandidate(
      createCandidate({
        memoryType:
          "topic",

        seed:
          "main-topic",

        memoryKey:
          "topic:main",

        title:
          "موضوع اصلی گفتگو",

        content:
          conversationTitle,

        valueJson: {
          conversationTitle,

          assistantMode:
            input.assistantMode,
        },

        importance:
          5,

        confidence:
          1,

        isPinned:
          true,

        sourceMessageIds:
          recentUserMessageIds,
      })
    );
  }

  const behaviorCandidates =
    getBehaviorProfileCandidates(
      input.behaviorProfile,

      recentUserMessageIds
    );

  for (
    const candidate of
      behaviorCandidates
  ) {
    addCandidate(
      candidate
    );
  }

  for (
    const message of
      userMessages
  ) {
    const sentences =
      splitSentences(
        message.content
      );

    for (
      const sentence of
        sentences
    ) {
      const sentenceCandidates =
        getSentenceCandidate(
          sentence,

          message.id
        );

      for (
        const candidate of
          sentenceCandidates
      ) {
        addCandidate(
          candidate
        );
      }
    }
  }

  return Array
    .from(
      candidateMap.values()
    )
    .sort(
      (
        first,

        second
      ) => {
        if (
          first.isPinned !==
          second.isPinned
        ) {
          return first.isPinned
            ? -1
            : 1;
        }

        return (
          second.importance -
          first.importance
        );
      }
    )
    .slice(
      0,

      MAX_MEMORY_ITEMS_PER_REFRESH
    );
}

export async function upsertStructuredMemoryCandidates(
  input:
    SaveStructuredMemoryInput
) {
  let insertedCount =
    0;

  let updatedCount =
    0;

  for (
    const candidate of
      input.candidates
  ) {
    const {
      data:
        existing,

      error:
        existingError,
    } =
      await input
        .supabase
        .from(
          "conversation_memory_items"
        )
        .select(
          `
          id,
          importance,
          confidence,
          is_pinned,
          source_message_ids
          `
        )
        .eq(
          "conversation_id",

          input.conversationId
        )
        .eq(
          "user_id",

          input.userId
        )
        .eq(
          "memory_key",

          candidate.memoryKey
        )
        .eq(
          "status",

          "active"
        )
        .maybeSingle();

    if (
      existingError
    ) {
      throw new Error(
        existingError.message
      );
    }

    const existingSourceIds =
      Array.isArray(
        existing
          ?.source_message_ids
      )
        ? existing
            .source_message_ids
            .filter(
              (
                value:
                  unknown
              ) =>
                typeof value ===
                "string"
            )
        : [];

    const mergedSourceIds =
      uniqueStrings(
        [
          ...existingSourceIds,

          ...candidate
            .sourceMessageIds,
        ],

        MAX_SOURCE_MESSAGE_IDS
      );

    const now =
      new Date()
        .toISOString();

    if (
      existing?.id
    ) {
      const {
        error:
          updateError,
      } =
        await input
          .supabase
          .from(
            "conversation_memory_items"
          )
          .update({
            memory_type:
              candidate.memoryType,

            title:
              candidate.title,

            content:
              candidate.content,

            value_json:
              candidate.valueJson,

            importance:
              Math.max(
                Number(
                  existing.importance ||
                  1
                ),

                candidate.importance
              ),

            confidence:
              Math.max(
                Number(
                  existing.confidence ||
                  0
                ),

                candidate.confidence
              ),

            is_pinned:
              Boolean(
                existing.is_pinned
              ) ||
              candidate.isPinned,

            source_message_ids:
              mergedSourceIds,

            last_confirmed_at:
              now,
          })
          .eq(
            "id",

            existing.id
          )
          .eq(
            "user_id",

            input.userId
          );

      if (
        updateError
      ) {
        throw new Error(
          updateError.message
        );
      }

      updatedCount++;

      continue;
    }

    const {
      error:
        insertError,
    } =
      await input
        .supabase
        .from(
          "conversation_memory_items"
        )
        .insert({
          conversation_id:
            input.conversationId,

          user_id:
            input.userId,

          memory_type:
            candidate.memoryType,

          memory_key:
            candidate.memoryKey,

          title:
            candidate.title,

          content:
            candidate.content,

          value_json:
            candidate.valueJson,

          importance:
            candidate.importance,

          confidence:
            candidate.confidence,

          status:
            candidate.status,

          is_pinned:
            candidate.isPinned,

          source_message_ids:
            mergedSourceIds,

          first_seen_at:
            now,

          last_confirmed_at:
            now,
        });

    if (
      insertError
    ) {
      throw new Error(
        insertError.message
      );
    }

    insertedCount++;
  }

  return {
    insertedCount,

    updatedCount,

    processedCount:
      input.candidates
        .length,
  };
}

export async function listStructuredMemoryItems(
  input:
    ListStructuredMemoryInput
) {
  const safeLimit =
    Math.min(
      100,

      Math.max(
        1,

        Math.floor(
          input.limit ||
          30
        )
      )
    );

  const {
    data,

    error,
  } =
    await input
      .supabase
      .from(
        "conversation_memory_items"
      )
      .select(
        `
        id,
        memory_type,
        memory_key,
        title,
        content,
        value_json,
        importance,
        confidence,
        status,
        is_pinned,
        source_message_ids,
        first_seen_at,
        last_confirmed_at,
        created_at,
        updated_at
        `
      )
      .eq(
        "conversation_id",

        input.conversationId
      )
      .eq(
        "user_id",

        input.userId
      )
      .eq(
        "status",

        "active"
      )
      .order(
        "is_pinned",

        {
          ascending:
            false,
        }
      )
      .order(
        "importance",

        {
          ascending:
            false,
        }
      )
      .order(
        "updated_at",

        {
          ascending:
            false,
        }
      )
      .limit(
        safeLimit
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return (
    data ||
    []
  ) as
    StructuredMemoryRecord[];
}

export function buildStructuredMemoryContext(
  items:
    StructuredMemoryRecord[]
) {
  const activeItems =
    items
      .filter(
        (
          item
        ) =>
          item.status ===
          "active"
      )
      .slice(
        0,
        24
      );

  if (
    activeItems.length ===
    0
  ) {
    return "";
  }

  const lines =
    activeItems.map(
      (
        item,

        index
      ) => {
        const pinnedLabel =
          item.is_pinned
            ? " | سنجاق‌شده"
            : "";

        return `${index + 1}. [${TYPE_LABELS[item.memory_type]} | اهمیت ${item.importance}${pinnedLabel}]
${item.content}`;
      }
    );

  return `
حافظه ساختاریافته این گفتگو:

${lines.join(
  "\n\n"
)}

قواعد استفاده:
- حافظه‌های سنجاق‌شده و دارای اهمیت بیشتر را جدی‌تر در نظر بگیر.
- آخرین درخواست صریح کاربر بر حافظه قبلی اولویت دارد.
- حافظه را به کاربر نسبت نده مگر اینکه مستقیماً مرتبط با پاسخ باشد.
- از حافظه برای حفظ اهداف، تصمیم‌ها، اعداد، محدودیت‌ها، ترجیحات و کارهای باز استفاده کن.
`.trim();
}