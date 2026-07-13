// app/api/chat/route.ts

import { NextRequest } from "next/server";

import { buildFilesContext } from "@/lib/file-utils";

import { getOpenRouterStream } from "@/lib/chatService";

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


type SavedMessageRecord = {
  id:
    string;

  role:
    "user" |
    "assistant";

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
    "mock" |
    "openrouter" |
    "none";
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
 * اگر برای گفتگو مدلی انتخاب نشده باشد،
 * OpenRouter انتخاب مدل را به‌صورت خودکار انجام می‌دهد.
 */
const DEFAULT_OPENROUTER_MODEL =
  "openrouter/auto";


/* =====================================================
   General helpers
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
 * خواندن امن مدل انتخاب‌شده
 *
 * اگر selected_model خالی یا null باشد،
 * مدل خودکار OpenRouter استفاده می‌شود.
 */
function getSelectedModel(
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


  return cleanValue ||
    DEFAULT_OPENROUTER_MODEL;
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
   Recent history
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
   Structured memory
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
   Semantic memory
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
   Automatic embedding
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
    /**
     * خطای Embedding نباید
     * پاسخ اصلی چت را از بین ببرد.
     *
     * API Backfill همچنان می‌تواند
     * پیام‌های باقی‌مانده را تعمیر کند.
     */
    console.error(
      "Automatic message embedding error:",

      error
    );
  }
}


/* =====================================================
   MOCK response
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

مدل انتخاب‌شده برای این گفتگو:
${selectedModel}

فرمان شما اجرا شد:
«${
  visibleUserMessage ||
  "فایل یا پیام بدون متن"
}»

وضعیت حافظه خلاصه‌شده:
${
  summaryMemoryIsActive
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

${
  semanticMemoryCount >
  0
    ? "پیام‌های قدیمی مرتبط با درخواست فعلی پیدا شده و وارد حافظه زمینه‌ای پاسخ شده‌اند."
    : "برای درخواست فعلی، پیام قدیمی مرتبطی وارد Context نشده است."
}

پس از کامل‌شدن این پاسخ:

۱. پیام کاربر در Supabase باقی می‌ماند.

۲. پاسخ دستیار در Supabase ذخیره می‌شود.

۳. Embedding پیام کاربر و پاسخ دستیار به‌صورت خودکار تولید می‌شود.

۴. بردارهای جدید در جدول messages ذخیره می‌شوند.

۵. موتور خلاصه و حافظه ساختاریافته می‌تواند به‌روزرسانی شود.

در حالت MOCK_AI پاسخ اصلی از OpenRouter دریافت نمی‌شود.

در حالت MOCK_EMBEDDINGS=true نیز بردارها بدون مصرف اعتبار OpenRouter ساخته می‌شوند.

پس از فعال‌شدن مدل واقعی، همین معماری بدون نیاز به Backfill دستی برای پیام‌های جدید ادامه خواهد یافت.
`.trim();
}


/* =====================================================
   MOCK stream
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
                    /**
                     * ابتدا:
                     *
                     * پاسخ ذخیره می‌شود
                     * و Embeddingها ساخته می‌شوند.
                     */
                    await onComplete(
                      mockText
                    );


                    /**
                     * سپس پایان Stream
                     * اعلام می‌شود.
                     */
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
   OpenRouter stream
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
            await reader.read();


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
              !trimmedLine.startsWith(
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
               * برخی Chunkها ممکن است
               * ناقص باشند.
               */
            }
          }
        }


        /**
         * پاسخ ذخیره و Embedding
         * قبل از بسته‌شدن Stream
         * ساخته می‌شود.
         */
        if (
          fullText.trim()
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
       3. Form data
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


    const historyRaw =
      String(
        formData.get(
          "history"
        ) ||

        "[]"
      );


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
       4. Validation
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
       5. Load conversation
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
       Selected OpenRouter model
    -------------------------------------------------- */

    const selectedModel =
      getSelectedModel(
        conversation
          .selected_model
      );


    /* -------------------------------------------------
       6. Parse history
    -------------------------------------------------- */

    let history:
      Message[] =
      [];


    try {
      history =
        JSON.parse(
          historyRaw
        );
    } catch {
      history =
        [];
    }


    let safeHistory =
      history.filter(
        (
          historyMessage
        ) =>
          historyMessage
            .role ===
            "user" ||

          historyMessage
            .role ===
            "assistant"
      );


    const lastHistoryMessage =
      safeHistory[
        safeHistory.length -
        1
      ];


    if (
      lastHistoryMessage
        ?.role ===
      "user"
    ) {
      const lastContent =
        getStringMessageContent(
          lastHistoryMessage
        );


      if (
        lastContent ===
          displayMessage ||

        lastContent ===
          message
      ) {
        safeHistory =
          safeHistory.slice(
            0,

            -1
          );
      }
    }


    /* -------------------------------------------------
       7. Memory settings
    -------------------------------------------------- */

    const memoryEnabled =
      conversation
        .memory_enabled !==
      false;


    /* -------------------------------------------------
       8. Summary and behavior
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
       9. Structured memory
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
       10. Recent raw history
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
       11. Files
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
       12. Semantic query
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
       13. Semantic memory
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
       14. Final system prompt
    -------------------------------------------------- */

    const baseSystemPrompt =
      buildSystemPrompt(
        assistantMode
      );


    const finalSystemPrompt =
      [
        baseSystemPrompt,

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
       15. Save user message
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

          user_id:
            user.id,

          role:
            "user",

          content:
            storedUserContent,
        })
        .select(
          "id,role,content"
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
       16. Update conversation
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
       17. Model messages
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


    /* -------------------------------------------------
       18. Save assistant and embeddings
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

              user_id:
                user.id,

              role:
                "assistant",

              content:
                assistantText,
            })
            .select(
              "id,role,content"
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
      };


    /* -------------------------------------------------
       19. MOCK
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
       20. OpenRouter
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