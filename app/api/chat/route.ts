// app/api/chat/route.ts

import {
  NextRequest,
} from "next/server";

import {
  buildFilesContext,
} from "@/lib/file-utils";

import {
  getOpenRouterStream,
} from "@/lib/chatService";

import type {
  AssistantModeId,
  Message,
} from "@/types/chat";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  buildSystemPrompt,
  isValidAssistantModeId,
} from "@/lib/assistant/prompts";

import {
  buildMemoryContextForPrompt,
  normalizeBehaviorProfile,
} from "@/lib/assistant/memory";

import {
  buildStructuredMemoryContext,
  listStructuredMemoryItems,
  type StructuredMemoryRecord,
} from "@/lib/assistant/structuredMemory";

import {
  buildSemanticMemoryContext,
  searchConversationSemanticMemory,
  type SemanticMemoryMatch,
} from "@/lib/assistant/semanticMemory";

import {
  embedNewMessages,
} from "@/lib/assistant/automaticMessageEmbeddings";

import {
  getDefaultModelForCurrentMode,
} from "@/lib/assistant/demoModelPolicy";

import {
  addTokenUsageByDecision,
  ensureUserAiCredits,
  estimateMessagesTokens,
  estimateTextTokens,
  markUpgradeWarningShown,
  resolveModelForUserCredits,
} from "@/lib/assistant/userCredits";


export const runtime =
  "nodejs";


/* =====================================================
   Types
===================================================== */

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;


type ConversationRecord = {
  id:
    string;

  title:
    string;

  user_id:
    string;

  active_branch_id:
    string | null;

  conversation_summary:
    string | null;

  summary_message_count:
    number | null;

  behavior_profile:
    Record<string, unknown> | null;

  memory_enabled:
    boolean | null;

  /**
   * مدل انتخاب‌شده برای همین گفتگو
   */
  selected_model:
    string | null;
};


type ConversationBranchRecord = {
  id:
    string;

  conversation_id:
    string;
};


type BranchHistoryMessageRecord = {
  role:
    | "user"
    | "assistant"
    | "system";

  content:
    string;

  created_at:
    string;
};


type SavedMessageRecord = {
  id:
    string;

  role:
    | "user"
    | "assistant";

  content:
    string;
};


type SemanticMemoryLoadResult = {
  context:
    string;

  matches:
    SemanticMemoryMatch[];

  matchCount:
    number;

  source:
    | "mock"
    | "openrouter"
    | "none";
};


/* =====================================================
   Constants
===================================================== */

const MAX_RECENT_HISTORY_MESSAGES =
  12;


const MAX_STRUCTURED_MEMORY_ITEMS =
  24;


const MAX_SEMANTIC_MEMORY_MATCHES =
  6;


const MIN_SEMANTIC_QUERY_LENGTH =
  2;


/**
 * مدل پیش‌فرض براساس سیاست مرکزی مدل‌ها
 */
const DEFAULT_OPENROUTER_MODEL =
  getDefaultModelForCurrentMode();


/* =====================================================
   General Helpers
===================================================== */

function getConversationTitle(
  message:
    string
) {
  const cleanMessage =
    message.trim();


  if (
    !cleanMessage
  ) {
    return "گفتگوی فایل";
  }


  return cleanMessage.length >
    32
    ? `${cleanMessage.slice(
      0,
      32
    )}...`
    : cleanMessage;
}


function getAssistantModeLabel(
  modeId:
    AssistantModeId
) {
  switch (
    modeId
  ) {
    case "official_letter":
      return "مکاتبات اداری";


    case "curriculum":
      return "برنامه‌درسی و مهارتی";


    case "research":
      return "پژوهش و فناوری";


    case "content":
      return "تولید محتوا";


    case "planning":
      return "برنامه‌ریزی و مدیریت";


    case "analysis":
      return "تحلیل اسناد";


    case "general":

    default:
      return "عمومی";
  }
}


/**
 * خواندن مدل درخواستی گفتگو
 *
 * این تابع فقط مقدار ذخیره‌شده در گفتگو را تمیز می‌کند.
 * تصمیم نهایی مجاز بودن مدل در userCredits.ts انجام می‌شود.
 */
function getRequestedModel(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return DEFAULT_OPENROUTER_MODEL;
  }


  const cleanValue =
    value.trim();


  if (
    !cleanValue
  ) {
    return DEFAULT_OPENROUTER_MODEL;
  }


  return cleanValue;
}


function getSafeSummaryMessageCount(
  value:
    unknown
) {
  if (
    typeof value !==
      "number" ||

    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }


  return Math.max(
    0,

    Math.floor(
      value
    )
  );
}


function getStringMessageContent(
  message:
    Message
) {
  return typeof message.content ===
    "string"
    ? message
      .content
      .trim()
    : "";
}


function normalizeComparableText(
  value:
    string
) {
  return value
    .normalize(
      "NFKC"
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
      /[^\p{L}\p{N}]+/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .toLowerCase();
}


/* =====================================================
   Active Conversation Branch
===================================================== */

/**
 * مقدار active_branch_id را برای یک گفتگو ذخیره می‌کند.
 */
async function updateConversationActiveBranch(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    branchId:
      string;
  }
) {
  const {
    error,
  } =
    await input.supabase
      .from(
        "conversations"
      )
      .update({
        active_branch_id:
          input.branchId,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        input.conversationId
      )
      .eq(
        "user_id",
        input.userId
      );


  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }
}


/**
 * شاخه فعال گفتگو را پیدا می‌کند.
 *
 * ترتیب تصمیم‌گیری:
 * 1. شاخه فعال ذخیره‌شده در conversations
 * 2. اولین شاخه موجود
 * 3. ساخت شاخه اصلی برای گفتگوهای جدید یا قدیمی
 */
async function ensureActiveConversationBranch(
  input: {
    supabase:
      SupabaseServerClient;

    conversation:
      ConversationRecord;

    userId:
      string;
  }
) {
  const {
    supabase,
    conversation,
    userId,
  } =
    input;


  /* -------------------------------------------------
     1. Validate stored active branch
  -------------------------------------------------- */

  if (
    conversation
      .active_branch_id
  ) {
    const {
      data:
        activeBranchData,

      error:
        activeBranchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id
          `
        )
        .eq(
          "id",
          conversation
            .active_branch_id
        )
        .eq(
          "conversation_id",
          conversation.id
        )
        .eq(
          "user_id",
          userId
        )
        .maybeSingle();


    if (
      activeBranchError
    ) {
      throw new Error(
        activeBranchError.message
      );
    }


    if (
      activeBranchData
    ) {
      return (
        activeBranchData as
          ConversationBranchRecord
      ).id;
    }
  }


  /* -------------------------------------------------
     2. Find the first existing branch
  -------------------------------------------------- */

  const {
    data:
      firstBranchData,

    error:
      firstBranchError,
  } =
    await supabase
      .from(
        "conversation_branches"
      )
      .select(
        `
          id,
          conversation_id
        `
      )
      .eq(
        "conversation_id",
        conversation.id
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "branch_order",
        {
          ascending:
            true,
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  if (
    firstBranchError
  ) {
    throw new Error(
      firstBranchError.message
    );
  }


  if (
    firstBranchData
  ) {
    const firstBranch =
      firstBranchData as
        ConversationBranchRecord;


    await updateConversationActiveBranch({
      supabase,

      conversationId:
        conversation.id,

      userId,

      branchId:
        firstBranch.id,
    });


    return firstBranch.id;
  }


  /* -------------------------------------------------
     3. Create the main branch
  -------------------------------------------------- */

  const {
    data:
      createdBranchData,

    error:
      createdBranchError,
  } =
    await supabase
      .from(
        "conversation_branches"
      )
      .insert({
        conversation_id:
          conversation.id,

        user_id:
          userId,

        title:
          "شاخه اصلی",

        branch_order:
          1,
      })
      .select(
        `
          id,
          conversation_id
        `
      )
      .single();


  if (
    createdBranchError ||
    !createdBranchData
  ) {
    /**
     * ممکن است در یک درخواست هم‌زمان،
     * شاخه اصلی لحظاتی قبل ساخته شده باشد.
     * بنابراین یک‌بار دیگر اولین شاخه را می‌خوانیم.
     */
    const {
      data:
        retryBranchData,

      error:
        retryBranchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id
          `
        )
        .eq(
          "conversation_id",
          conversation.id
        )
        .eq(
          "user_id",
          userId
        )
        .order(
          "branch_order",
          {
            ascending:
              true,
          }
        )
        .limit(
          1
        )
        .maybeSingle();


    if (
      retryBranchError ||
      !retryBranchData
    ) {
      throw new Error(
        createdBranchError
          ?.message ||

        retryBranchError
          ?.message ||

        "Could not create the main conversation branch."
      );
    }


    const retryBranch =
      retryBranchData as
        ConversationBranchRecord;


    await updateConversationActiveBranch({
      supabase,

      conversationId:
        conversation.id,

      userId,

      branchId:
        retryBranch.id,
    });


    return retryBranch.id;
  }


  const createdBranch =
    createdBranchData as
      ConversationBranchRecord;


  await updateConversationActiveBranch({
    supabase,

    conversationId:
      conversation.id,

    userId,

    branchId:
      createdBranch.id,
  });


  return createdBranch.id;
}


/**
 * تاریخچه پیام‌ها را مستقیماً از پایگاه داده و
 * فقط از شاخه فعال دریافت می‌کند.
 *
 * در نتیجه تاریخچه ارسال‌شده از مرورگر مبنای Context مدل نیست.
 */
async function loadActiveBranchHistory(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    branchId:
      string;

    userId:
      string;
  }
):
  Promise<Message[]> {
  const {
    data,
    error,
  } =
    await input.supabase
      .from(
        "messages"
      )
      .select(
        `
          role,
          content,
          created_at
        `
      )
      .eq(
        "conversation_id",
        input.conversationId
      )
      .eq(
        "branch_id",
        input.branchId
      )
      .eq(
        "user_id",
        input.userId
      )
      .in(
        "role",
        [
          "user",
          "assistant",
        ]
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );


  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }


  const records =
    (
      data ||
      []
    ) as
      BranchHistoryMessageRecord[];


  return records.map(
    (
      record
    ) => ({
      role:
        record.role as
          | "user"
          | "assistant",

      content:
        record.content,
    })
  );
}


/* =====================================================
   Recent History
===================================================== */

function getHistoryForModel(
  history:
    Message[],

  summaryMessageCount:
    number,

  hasConversationSummary:
    boolean
) {
  if (
    !hasConversationSummary
  ) {
    return history.slice(
      -MAX_RECENT_HISTORY_MESSAGES
    );
  }


  const safeStartIndex =
    Math.min(
      summaryMessageCount,
      history.length
    );


  return history
    .slice(
      safeStartIndex
    )
    .slice(
      -MAX_RECENT_HISTORY_MESSAGES
    );
}


/* =====================================================
   Structured Memory
===================================================== */

async function loadStructuredMemorySafely(
  supabase:
    SupabaseServerClient,

  conversationId:
    string,

  userId:
    string
):
  Promise<
    StructuredMemoryRecord[]
  > {
  try {
    return await listStructuredMemoryItems({
      supabase,

      conversationId,

      userId,

      limit:
        MAX_STRUCTURED_MEMORY_ITEMS,
    });
  } catch (
    error
  ) {
    console.error(
      "Load structured memory error:",

      error
    );


    return [];
  }
}


/* =====================================================
   Semantic Memory
===================================================== */

function removeRecentHistoryDuplicates(
  matches:
    SemanticMemoryMatch[],

  recentHistory:
    Message[]
) {
  const recentContents =
    new Set(
      recentHistory
        .map(
          (
            message
          ) =>
            getStringMessageContent(
              message
            )
        )
        .filter(
          Boolean
        )
        .map(
          normalizeComparableText
        )
    );


  return matches.filter(
    (
      match
    ) => {
      const normalizedContent =
        normalizeComparableText(
          match.content
        );


      if (
        !normalizedContent
      ) {
        return false;
      }


      return !recentContents.has(
        normalizedContent
      );
    }
  );
}


async function loadSemanticMemorySafely(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    query:
      string;

    recentHistory:
      Message[];
  }
):
  Promise<
    SemanticMemoryLoadResult
  > {
  const normalizedQuery =
    input.query
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  if (
    normalizedQuery.length <
    MIN_SEMANTIC_QUERY_LENGTH
  ) {
    return {
      context:
        "",

      matches:
        [],

      matchCount:
        0,

      source:
        "none",
    };
  }


  try {
    const result =
      await searchConversationSemanticMemory({
        supabase:
          input.supabase,

        conversationId:
          input.conversationId,

        userId:
          input.userId,

        query:
          normalizedQuery,

        matchCount:
          MAX_SEMANTIC_MEMORY_MATCHES,
      });


    const filteredMatches =
      removeRecentHistoryDuplicates(
        result.matches,

        input.recentHistory
      );


    return {
      context:
        buildSemanticMemoryContext(
          filteredMatches
        ),

      matches:
        filteredMatches,

      matchCount:
        filteredMatches.length,

      source:
        result.source,
    };
  } catch (
    error
  ) {
    console.error(
      "Load semantic memory error:",

      error
    );


    return {
      context:
        "",

      matches:
        [],

      matchCount:
        0,

      source:
        "none",
    };
  }
}


/* =====================================================
   Automatic Embedding
===================================================== */

async function embedSavedMessagesSafely(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    userMessage:
      SavedMessageRecord;

    assistantMessage:
      SavedMessageRecord;
  }
) {
  try {
    const result =
      await embedNewMessages({
        supabase:
          input.supabase,

        conversationId:
          input.conversationId,

        userId:
          input.userId,

        messages: [
          {
            id:
              input
                .userMessage
                .id,

            role:
              "user",

            content:
              input
                .userMessage
                .content,
          },

          {
            id:
              input
                .assistantMessage
                .id,

            role:
              "assistant",

            content:
              input
                .assistantMessage
                .content,
          },
        ],
      });


    console.log(
      "Automatic message embeddings:",

      {
        source:
          result.source,

        model:
          result.model,

        processedCount:
          result.processedCount,

        skippedCount:
          result.skippedCount,

        failedCount:
          result.failedCount,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Automatic message embedding error:",

      error
    );
  }
}


/* =====================================================
   MOCK Response
===================================================== */

function createMockText(
  visibleUserMessage:
    string,

  assistantMode:
    AssistantModeId,

  selectedModel:
    string,

  summaryMemoryIsActive:
    boolean,

  recentHistoryCount:
    number,

  structuredMemoryCount:
    number,

  semanticMemoryCount:
    number,

  semanticMemorySource:
    string
) {
  return `
این یک پاسخ آزمایشی از حالت MOCK_AI است.

حالت کاری انتخاب‌شده:
${getAssistantModeLabel(
    assistantMode
  )}

مدل مؤثر برای این گفتگو:
${selectedModel}

فرمان شما اجرا شد:
«${visibleUserMessage ||
    "فایل یا پیام بدون متن"
    }»

وضعیت حافظه خلاصه‌شده:
${summaryMemoryIsActive
      ? "خلاصه گفتگو و پروفایل رفتاری با موفقیت خوانده و وارد system prompt شده‌اند."
      : "هنوز خلاصه یا پروفایل رفتاری قابل استفاده‌ای برای این گفتگو وجود ندارد."
    }

تعداد پیام‌های جدید و خلاصه‌نشده:
${recentHistoryCount}

تعداد حافظه‌های ساختاریافته فعال:
${structuredMemoryCount}

تعداد پیام‌های قدیمی بازیابی‌شده از حافظه معنایی:
${semanticMemoryCount}

منبع جست‌وجوی معنایی:
${semanticMemorySource}

${semanticMemoryCount >
      0
      ? "پیام‌های قدیمی مرتبط با درخواست فعلی پیدا شده و وارد حافظه زمینه‌ای پاسخ شده‌اند."
      : "برای درخواست فعلی، پیام قدیمی مرتبطی وارد Context نشده است."
    }

پس از کامل‌شدن این پاسخ، پیام‌ها ذخیره و در صورت فعال بودن، Embeddingها ساخته می‌شوند.
`.trim();
}


/* =====================================================
   MOCK Stream
===================================================== */

function createMockSavingStream(
  mockText:
    string,

  onComplete:
    (
      assistantText:
        string
    ) =>
      Promise<void>
) {
  const encoder =
    new TextEncoder();


  return new ReadableStream({
    start(
      controller
    ) {
      const words =
        mockText.split(
          " "
        );


      let index =
        0;


      let finalizing =
        false;


      const interval =
        setInterval(
          () => {
            if (
              index >=
              words.length
            ) {
              if (
                finalizing
              ) {
                return;
              }


              finalizing =
                true;


              clearInterval(
                interval
              );


              void (
                async () => {
                  try {
                    await onComplete(
                      mockText
                    );


                    controller.enqueue(
                      encoder.encode(
                        "data: [DONE]\n\n"
                      )
                    );


                    controller.close();
                  } catch (
                    error
                  ) {
                    console.error(
                      "Mock response saving error:",

                      error
                    );


                    controller.error(
                      error
                    );
                  }
                }
              )();


              return;
            }


            const chunk = {
              choices: [
                {
                  delta: {
                    content:
                      `${words[index]} `,
                  },
                },
              ],
            };


            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify(
                  chunk
                )}\n\n`
              )
            );


            index++;
          },

          70
        );
    },
  });
}


/* =====================================================
   OpenRouter Stream
===================================================== */

function createOpenRouterSavingStream(
  body:
    ReadableStream<Uint8Array>,

  onComplete:
    (
      assistantText:
        string
    ) =>
      Promise<void>
) {
  const encoder =
    new TextEncoder();


  const decoder =
    new TextDecoder();


  return new ReadableStream({
    async start(
      controller
    ) {
      const reader =
        body.getReader();


      let fullText =
        "";


      let buffer =
        "";


      try {
        while (
          true
        ) {
          const {
            value,
            done,
          } =
            await reader
              .read();


          if (
            done
          ) {
            break;
          }


          const chunkText =
            decoder.decode(
              value,

              {
                stream:
                  true,
              }
            );


          controller.enqueue(
            encoder.encode(
              chunkText
            )
          );


          buffer +=
            chunkText;


          const lines =
            buffer.split(
              "\n"
            );


          buffer =
            lines.pop() ||
            "";


          for (
            const line of
            lines
          ) {
            const trimmedLine =
              line.trim();


            if (
              !trimmedLine
                .startsWith(
                  "data: "
                )
            ) {
              continue;
            }


            const data =
              trimmedLine
                .replace(
                  "data: ",
                  ""
                )
                .trim();


            if (
              !data ||
              data ===
                "[DONE]"
            ) {
              continue;
            }


            try {
              const json =
                JSON.parse(
                  data
                );


              const content =
                json
                  .choices?.[
                    0
                  ]
                  ?.delta
                  ?.content ||

                "";


              if (
                content
              ) {
                fullText +=
                  content;
              }
            } catch {
              /**
               * برخی Chunkها ممکن است ناقص باشند.
               */
            }
          }
        }


        if (
          fullText
            .trim()
        ) {
          await onComplete(
            fullText
          );
        }


        controller.close();
      } catch (
        error
      ) {
        console.error(
          "OpenRouter stream proxy error:",

          error
        );


        controller.error(
          error
        );
      }
    },
  });
}


/* =====================================================
   POST /api/chat
===================================================== */

export async function POST(
  request:
    NextRequest
) {
  try {
    /* -------------------------------------------------
       1. Supabase
    -------------------------------------------------- */

    const supabase =
      await createSupabaseServerClient();


    /* -------------------------------------------------
       2. Authentication
    -------------------------------------------------- */

    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabase
        .auth
        .getUser();


    if (
      userError ||
      !user
    ) {
      return new Response(
        "Unauthorized",

        {
          status:
            401,
        }
      );
    }


    /* -------------------------------------------------
       3. User AI Credits
    -------------------------------------------------- */

    const userCredits =
      await ensureUserAiCredits({
        supabase,

        userId:
          user.id,
      });


    /* -------------------------------------------------
       4. Form Data
    -------------------------------------------------- */

    const formData =
      await request
        .formData();


    const conversationId =
      String(
        formData.get(
          "conversationId"
        ) ||
        ""
      ).trim();


    const message =
      String(
        formData.get(
          "message"
        ) ||
        ""
      ).trim();


    const displayMessage =
      String(
        formData.get(
          "displayMessage"
        ) ||
        message
      ).trim();


    const assistantModeRaw =
      String(
        formData.get(
          "assistantMode"
        ) ||
        "general"
      ).trim();


    const assistantMode:
      AssistantModeId =
      isValidAssistantModeId(
        assistantModeRaw
      )
        ? assistantModeRaw
        : "general";


    const files =
      formData.getAll(
        "files"
      ) as
        File[];


    /* -------------------------------------------------
       5. Validation
    -------------------------------------------------- */

    if (
      !conversationId
    ) {
      return new Response(
        "conversationId is required",

        {
          status:
            400,
        }
      );
    }


    if (
      !message &&
      files.length ===
        0
    ) {
      return new Response(
        "Message or file is required",

        {
          status:
            400,
        }
      );
    }


    /* -------------------------------------------------
       6. Load Conversation
    -------------------------------------------------- */

    const {
      data:
        conversationData,

      error:
        conversationError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select(
          `
            id,
            title,
            user_id,
            active_branch_id,
            conversation_summary,
            summary_message_count,
            behavior_profile,
            memory_enabled,
            selected_model
          `
        )
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .single();


    const conversation =
      conversationData as
        | ConversationRecord
        | null;


    if (
      conversationError ||
      !conversation
    ) {
      return new Response(
        "Conversation not found",

        {
          status:
            404,
        }
      );
    }


    /* -------------------------------------------------
       7. Resolve Active Branch
    -------------------------------------------------- */

    let activeBranchId:
      string;


    try {
      activeBranchId =
        await ensureActiveConversationBranch({
          supabase,

          conversation,

          userId:
            user.id,
        });
    } catch (
      error
    ) {
      console.error(
        "Resolve active branch error:",

        error
      );


      return new Response(
        "Could not resolve active conversation branch",

        {
          status:
            500,
        }
      );
    }


    /* -------------------------------------------------
       8. Load Trusted Branch History

       تاریخچه مستقیماً از Supabase خوانده می‌شود.
       مقدار history ارسالی مرورگر مبنای Context نیست.
    -------------------------------------------------- */

    let safeHistory:
      Message[];


    try {
      safeHistory =
        await loadActiveBranchHistory({
          supabase,

          conversationId,

          branchId:
            activeBranchId,

          userId:
            user.id,
        });
    } catch (
      error
    ) {
      console.error(
        "Load active branch history error:",

        error
      );


      return new Response(
        "Could not load active branch history",

        {
          status:
            500,
        }
      );
    }


    /* -------------------------------------------------
       9. Model Decision by Credits
    -------------------------------------------------- */

    const requestedModel =
      getRequestedModel(
        conversation
          .selected_model
      );


    const modelDecision =
      resolveModelForUserCredits({
        requestedModel,

        credits:
          userCredits,
      });


    const selectedModel =
      modelDecision
        .effectiveModel;


    const shouldShowCreditWarning =
      modelDecision
        .shouldShowUpgradeWarning &&

      !modelDecision
        .credits
        .warning_shown;


    const creditWarningPrompt =
      shouldShowCreditWarning
        ? `
اطلاع مهم برای کاربر:
${modelDecision.warningText}

این اطلاع را در ابتدای پاسخ، کوتاه و محترمانه نمایش بده و سپس پاسخ اصلی را با مدل رایگان ادامه بده.
`.trim()
        : "";


    console.log(
      "[user-credit-model-decision]",

      {
        requestedModel:
          modelDecision
            .requestedModel,

        effectiveModel:
          modelDecision
            .effectiveModel,

        hasTrialAccess:
          modelDecision
            .hasTrialAccess,

        hasSubscriptionAccess:
          modelDecision
            .hasSubscriptionAccess,

        remainingTrialTokens:
          modelDecision
            .remainingTrialTokens,

        shouldShowUpgradeWarning:
          shouldShowCreditWarning,

        activeBranchId,

        branchHistoryCount:
          safeHistory.length,
      }
    );


    /* -------------------------------------------------
       10. Memory Settings
    -------------------------------------------------- */

    const memoryEnabled =
      conversation
        .memory_enabled !==
      false;


    /* -------------------------------------------------
       11. Summary and Behavior
    -------------------------------------------------- */

    const behaviorProfile =
      normalizeBehaviorProfile(
        conversation
          .behavior_profile
      );


    const summaryMemoryContext =
      memoryEnabled
        ? buildMemoryContextForPrompt(
          conversation
            .conversation_summary ||
          "",

          behaviorProfile
        )
        : "";


    /* -------------------------------------------------
       12. Structured Memory
    -------------------------------------------------- */

    const structuredMemoryItems =
      memoryEnabled
        ? await loadStructuredMemorySafely(
          supabase,

          conversationId,

          user.id
        )
        : [];


    const structuredMemoryContext =
      memoryEnabled
        ? buildStructuredMemoryContext(
          structuredMemoryItems
        )
        : "";


    /* -------------------------------------------------
       13. Recent Raw Branch History
    -------------------------------------------------- */

    const summaryMessageCount =
      getSafeSummaryMessageCount(
        conversation
          .summary_message_count
      );


    const hasConversationSummary =
      Boolean(
        conversation
          .conversation_summary
          ?.trim()
      );


    const historyForModel =
      getHistoryForModel(
        safeHistory,

        summaryMessageCount,

        hasConversationSummary
      );


    /* -------------------------------------------------
       14. Files
    -------------------------------------------------- */

    const {
      textContext,
      images,
    } =
      await buildFilesContext(
        files
      );


    const storedUserContent =
      displayMessage ||
      message ||
      "📎 [File Uploaded]";


    const userText =
      textContext
        ? `${message}

متن استخراج‌شده از فایل‌های پیوست:

${textContext}`
        : message;


    /* -------------------------------------------------
       15. Semantic Query
    -------------------------------------------------- */

    const semanticQuery =
      [
        message,

        !message &&
          textContext
          ? textContext.slice(
            0,
            2500
          )
          : "",
      ]
        .filter(
          Boolean
        )
        .join(
          "\n\n"
        )
        .trim();


    /* -------------------------------------------------
       16. Semantic Memory
    -------------------------------------------------- */

    const semanticMemory =
      memoryEnabled
        ? await loadSemanticMemorySafely({
          supabase,

          conversationId,

          userId:
            user.id,

          query:
            semanticQuery,

          recentHistory:
            historyForModel,
        })
        : {
          context:
            "",

          matches:
            [],

          matchCount:
            0,

          source:
            "none" as const,
        };


    /* -------------------------------------------------
       17. Final System Prompt
    -------------------------------------------------- */

    const baseSystemPrompt =
      buildSystemPrompt(
        assistantMode
      );


    const finalSystemPrompt =
      [
        baseSystemPrompt,

        creditWarningPrompt,

        summaryMemoryContext,

        structuredMemoryContext,

        semanticMemory
          .context,
      ]
        .filter(
          Boolean
        )
        .join(
          "\n\n"
        );


    /* -------------------------------------------------
       18. Save User Message in Active Branch
    -------------------------------------------------- */

    const {
      data:
        savedUserMessageData,

      error:
        insertUserMessageError,
    } =
      await supabase
        .from(
          "messages"
        )
        .insert({
          conversation_id:
            conversationId,

          branch_id:
            activeBranchId,

          user_id:
            user.id,

          role:
            "user",

          content:
            storedUserContent,
        })
        .select(
          `
            id,
            role,
            content
          `
        )
        .single();


    const savedUserMessage =
      savedUserMessageData as
        | SavedMessageRecord
        | null;


    if (
      insertUserMessageError ||
      !savedUserMessage
    ) {
      console.error(
        "Insert user message error:",

        insertUserMessageError
      );


      return new Response(
        "Could not save user message",

        {
          status:
            500,
        }
      );
    }


    /* -------------------------------------------------
       19. Update Conversation
    -------------------------------------------------- */

    const shouldUpdateTitle =
      conversation.title ===
        "گفتگوی جدید" ||

      conversation.title ===
        "گفتگوی فایل";


    const {
      error:
        updateConversationError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .update({
          title:
            shouldUpdateTitle
              ? getConversationTitle(
                storedUserContent
              )
              : conversation
                .title,

          active_branch_id:
            activeBranchId,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        );


    if (
      updateConversationError
    ) {
      console.error(
        "Update conversation error:",

        updateConversationError
      );
    }


    /* -------------------------------------------------
       20. Model Messages
    -------------------------------------------------- */

    const messages:
      Message[] =
      [
        {
          role:
            "system",

          content:
            finalSystemPrompt,
        },

        ...historyForModel,

        {
          role:
            "user",

          content: [
            {
              type:
                "text",

              text:
                userText,
            },

            ...images,
          ],
        },
      ];


    const requestEstimatedTokens =
      estimateMessagesTokens(
        messages
      );


    /* -------------------------------------------------
       21. Save Assistant Message and Update Usage
    -------------------------------------------------- */

    const saveAssistantMessage =
      async (
        assistantText:
          string
      ) => {
        if (
          !assistantText
            .trim()
        ) {
          return;
        }


        const {
          data:
            savedAssistantMessageData,

          error:
            assistantInsertError,
        } =
          await supabase
            .from(
              "messages"
            )
            .insert({
              conversation_id:
                conversationId,

              branch_id:
                activeBranchId,

              user_id:
                user.id,

              role:
                "assistant",

              content:
                assistantText,
            })
            .select(
              `
                id,
                role,
                content
              `
            )
            .single();


        const savedAssistantMessage =
          savedAssistantMessageData as
            | SavedMessageRecord
            | null;


        if (
          assistantInsertError ||
          !savedAssistantMessage
        ) {
          throw new Error(
            assistantInsertError
              ?.message ||

            "Could not save assistant message."
          );
        }


        const {
          error:
            timestampError,
        } =
          await supabase
            .from(
              "conversations"
            )
            .update({
              active_branch_id:
                activeBranchId,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              conversationId
            )
            .eq(
              "user_id",
              user.id
            );


        if (
          timestampError
        ) {
          console.error(
            "Update conversation timestamp error:",

            timestampError
          );
        }


        /**
         * پیام کاربر و پاسخ دستیار
         * به‌صورت خودکار Embedding می‌شوند.
         */
        await embedSavedMessagesSafely({
          supabase,

          conversationId,

          userId:
            user.id,

          userMessage:
            savedUserMessage,

          assistantMessage:
            savedAssistantMessage,
        });


        /**
         * ثبت مصرف اعتبار کاربر
         *
         * براساس تصمیم مدل:
         * - Trial از trial_tokens_used کم می‌شود.
         * - اشتراک Pro از monthly_tokens_used کم می‌شود.
         * - حالت رایگان هیچ اعتباری مصرف نمی‌کند.
         */
        if (
          process.env.MOCK_AI !==
          "true"
        ) {
          const responseEstimatedTokens =
            estimateTextTokens(
              assistantText
            );


          const totalEstimatedTokens =
            requestEstimatedTokens +
            responseEstimatedTokens;


          await addTokenUsageByDecision({
            supabase,

            userId:
              user.id,

            decision:
              modelDecision,

            tokensToAdd:
              totalEstimatedTokens,
          });


          console.log(
            "[user-token-usage]",

            {
              effectiveAccess:
                modelDecision
                  .effectiveAccess,

              shouldCountTrialUsage:
                modelDecision
                  .shouldCountTrialUsage,

              shouldCountMonthlyUsage:
                modelDecision
                  .shouldCountMonthlyUsage,

              requestEstimatedTokens,

              responseEstimatedTokens,

              totalEstimatedTokens,

              activeBranchId,
            }
          );
        }


        /**
         * ثبت اینکه هشدار پایان اعتبار نمایش داده شده است.
         */
        if (
          shouldShowCreditWarning
        ) {
          await markUpgradeWarningShown({
            supabase,

            userId:
              user.id,
          });
        }
      };


    /* -------------------------------------------------
       22. MOCK
    -------------------------------------------------- */

    if (
      process.env
        .MOCK_AI ===
      "true"
    ) {
      const mockText =
        createMockText(
          storedUserContent,

          assistantMode,

          selectedModel,

          Boolean(
            summaryMemoryContext
          ),

          historyForModel
            .length,

          structuredMemoryItems
            .length,

          semanticMemory
            .matchCount,

          semanticMemory
            .source
        );


      const mockStream =
        createMockSavingStream(
          mockText,

          saveAssistantMessage
        );


      return new Response(
        mockStream,

        {
          headers: {
            "Content-Type":
              "text/event-stream; charset=utf-8",

            "Cache-Control":
              "no-cache, no-transform",

            Connection:
              "keep-alive",
          },
        }
      );
    }


    /* -------------------------------------------------
       23. OpenRouter
    -------------------------------------------------- */

    const response =
      await getOpenRouterStream(
        messages,

        selectedModel
      );


    if (
      !response.ok
    ) {
      const errorText =
        await response
          .text();


      return new Response(
        errorText ||
        "OpenRouter error",

        {
          status:
            response.status,
        }
      );
    }


    if (
      !response.body
    ) {
      return new Response(
        "OpenRouter response body is empty",

        {
          status:
            500,
        }
      );
    }


    const savingStream =
      createOpenRouterSavingStream(
        response.body,

        saveAssistantMessage
      );


    return new Response(
      savingStream,

      {
        headers: {
          "Content-Type":
            "text/event-stream; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Chat route error:",

      error
    );


    return new Response(
      "Internal server error",

      {
        status:
          500,
      }
    );
  }
}