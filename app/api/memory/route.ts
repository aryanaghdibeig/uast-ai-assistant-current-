// app/api/memory/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getOpenRouterStream,
} from "@/lib/chatService";

import type {
  AssistantModeId,
  Message,
} from "@/types/chat";

import {
  buildMemoryPrompt,
  createMockMemoryResult,
  extractJsonObject,
  normalizeBehaviorProfile,
  parseMemoryResult,
  type ConversationBehaviorProfile,
  type ConversationMemoryResult,
  type MemoryMessage,
} from "@/lib/assistant/memory";

import {
  isValidAssistantModeId,
} from "@/lib/assistant/prompts";

import {
  extractStructuredMemoryCandidates,
  listStructuredMemoryItems,
  upsertStructuredMemoryCandidates,
  type StructuredMemoryMessage,
  type StructuredMemoryRecord,
} from "@/lib/assistant/structuredMemory";

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;

type DbConversation = {
  id:
    string;

  user_id:
    string;

  title:
    string;

  assistant_mode:
    string | null;

  conversation_summary:
    string | null;

  summary_message_count:
    number | null;

  summary_updated_at:
    string | null;

  behavior_profile:
    Record<
      string,
      unknown
    > | null;

  behavior_profile_updated_at:
    string | null;

  memory_enabled:
    boolean | null;
};

type DbMessage = {
  id:
    string;

  role:
    | "user"
    | "assistant"
    | "system";

  content:
    string;

  created_at:
    string;
};

type MemoryResponseOptions = {
  structuredItems?:
    StructuredMemoryRecord[];

  structuredMemorySource?:
    string;

  structuredMemoryProcessedCount?:
    number;
};

function getSafeAssistantMode(
  value:
    unknown
):
  AssistantModeId {
  if (
    typeof value ===
      "string" &&
    isValidAssistantModeId(
      value
    )
  ) {
    return value;
  }

  return "general";
}

function getSafeInteger(
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

async function readStreamText(
  body:
    ReadableStream<Uint8Array>
) {
  const reader =
    body.getReader();

  const decoder =
    new TextDecoder();

  let fullText =
    "";

  let buffer =
    "";

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

    buffer +=
      decoder.decode(
        value,

        {
          stream:
            true,
        }
      );

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
            .choices?.[0]
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
        // بعضی بخش‌های Stream
        // ممکن است ناقص باشند.
      }
    }
  }

  return fullText.trim();
}

async function findConversation(
  supabase:
    SupabaseServerClient,

  userId:
    string,

  requestedConversationId:
    string
) {
  const selectFields =
    `
    id,
    user_id,
    title,
    assistant_mode,
    conversation_summary,
    summary_message_count,
    summary_updated_at,
    behavior_profile,
    behavior_profile_updated_at,
    memory_enabled
    `;

  if (
    requestedConversationId
  ) {
    const {
      data,

      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select(
          selectFields
        )
        .eq(
          "id",

          requestedConversationId
        )
        .eq(
          "user_id",

          userId
        )
        .single();

    return {
      conversation:
        data as
          DbConversation | null,

      error,
    };
  }

  const {
    data,

    error,
  } =
    await supabase
      .from(
        "conversations"
      )
      .select(
        selectFields
      )
      .eq(
        "user_id",

        userId
      )
      .order(
        "updated_at",

        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();

  return {
    conversation:
      data as
        DbConversation | null,

    error,
  };
}

async function loadConversationMessages(
  supabase:
    SupabaseServerClient,

  conversationId:
    string,

  userId:
    string
) {
  const {
    data,

    error,
  } =
    await supabase
      .from(
        "messages"
      )
      .select(
        `
        id,
        role,
        content,
        created_at
        `
      )
      .eq(
        "conversation_id",

        conversationId
      )
      .eq(
        "user_id",

        userId
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

  return (
    data ||
    []
  ) as
    DbMessage[];
}

async function loadStructuredItems(
  supabase:
    SupabaseServerClient,

  conversationId:
    string,

  userId:
    string
) {
  return listStructuredMemoryItems({
    supabase,

    conversationId,

    userId,

    limit:
      40,
  });
}

function buildMemoryResponse(
  conversation:
    DbConversation,

  options:
    MemoryResponseOptions =
      {}
) {
  return {
    conversationId:
      conversation.id,

    title:
      conversation.title,

    assistantMode:
      getSafeAssistantMode(
        conversation
          .assistant_mode
      ),

    summary:
      conversation
        .conversation_summary ||
      "",

    summaryMessageCount:
      getSafeInteger(
        conversation
          .summary_message_count
      ),

    summaryUpdatedAt:
      conversation
        .summary_updated_at,

    behaviorProfile:
      normalizeBehaviorProfile(
        conversation
          .behavior_profile
      ),

    behaviorProfileUpdatedAt:
      conversation
        .behavior_profile_updated_at,

    memoryEnabled:
      conversation
        .memory_enabled !==
      false,

    structuredItems:
      options
        .structuredItems ||
      [],

    structuredMemory: {
      source:
        options
          .structuredMemorySource ||
        "current",

      processedCount:
        options
          .structuredMemoryProcessedCount ||
        0,

      itemCount:
        options
          .structuredItems
          ?.length ||
        0,
    },
  };
}

function toMemoryMessages(
  rows:
    DbMessage[]
):
  MemoryMessage[] {
  return rows.map(
    (
      message
    ) => ({
      role:
        message.role ===
        "assistant"
          ? "assistant"
          : "user",

      content:
        message.content,

      created_at:
        message.created_at,
    })
  );
}

function toStructuredMemoryMessages(
  rows:
    DbMessage[]
):
  StructuredMemoryMessage[] {
  return rows.map(
    (
      message
    ) => ({
      id:
        message.id,

      role:
        message.role,

      content:
        message.content,

      createdAt:
        message.created_at,
    })
  );
}

async function refreshStructuredMemory(
  input: {
    supabase:
      SupabaseServerClient;

    conversation:
      DbConversation;

    userId:
      string;

    allMessages:
      DbMessage[];

    previousSummaryMessageCount:
      number;

    summary:
      string;

    behaviorProfile:
      ConversationBehaviorProfile;

    forceBackfill?:
      boolean;
  }
) {
  const existingItems =
    await loadStructuredItems(
      input.supabase,

      input
        .conversation
        .id,

      input.userId
    );

  const needsInitialBackfill =
    existingItems.length ===
    0;

  const shouldBackfill =
    input.forceBackfill ||
    needsInitialBackfill;

  let sourceRows:
    DbMessage[];

  if (
    shouldBackfill
  ) {
    /*
     * در اولین اجرا، حداکثر ۴۰۰ پیام
     * برای ساخت حافظه ساختاریافته بررسی می‌شوند.
     *
     * برای گفتگوی ۳۰۰ پیامی،
     * تمام پیام‌ها بررسی خواهند شد.
     */
    sourceRows =
      input
        .allMessages
        .slice(
          -400
        );
  } else {
    /*
     * در اجراهای بعدی،
     * فقط پیام‌های جدید به همراه
     * ۶ پیام قبل از آن بررسی می‌شوند.
     */
    const contextStartIndex =
      Math.max(
        0,

        input
          .previousSummaryMessageCount -
        6
      );

    sourceRows =
      input
        .allMessages
        .slice(
          contextStartIndex
        );
  }

  if (
    sourceRows.length ===
    0
  ) {
    return {
      items:
        existingItems,

      source:
        "no_messages",

      processedCount:
        0,
    };
  }

  const candidates =
    extractStructuredMemoryCandidates({
      conversationTitle:
        input
          .conversation
          .title,

      assistantMode:
        getSafeAssistantMode(
          input
            .conversation
            .assistant_mode
        ),

      summary:
        input.summary,

      behaviorProfile:
        input
          .behaviorProfile,

      messages:
        toStructuredMemoryMessages(
          sourceRows
        ),
    });

  const saveResult =
    await upsertStructuredMemoryCandidates({
      supabase:
        input.supabase,

      conversationId:
        input
          .conversation
          .id,

      userId:
        input.userId,

      candidates,
    });

  const updatedItems =
    await loadStructuredItems(
      input.supabase,

      input
        .conversation
        .id,

      input.userId
    );

  return {
    items:
      updatedItems,

    source:
      shouldBackfill
        ? "initial_backfill"
        : "incremental",

    processedCount:
      saveResult
        .processedCount,
  };
}

export async function GET(
  request:
    NextRequest
) {
  try {
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

    const {
      supabase,

      user,
    } =
      auth;

    const conversationId =
      request
        .nextUrl
        .searchParams
        .get(
          "conversationId"
        )
        ?.trim() ||
      "";

    const {
      conversation,

      error,
    } =
      await findConversation(
        supabase,

        user.id,

        conversationId
      );

    if (
      error ||
      !conversation
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation not found.",

          error:
            error
              ?.message,
        },

        {
          status:
            404,
        }
      );
    }

    const structuredItems =
      await loadStructuredItems(
        supabase,

        conversation.id,

        user.id
      );

    return NextResponse.json({
      ok:
        true,

      memory:
        buildMemoryResponse(
          conversation,

          {
            structuredItems,
          }
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "Memory GET error:",

      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load conversation memory.",

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

export async function POST(
  request:
    NextRequest
) {
  try {
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

    const {
      supabase,

      user,
    } =
      auth;

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const requestedConversationId =
      typeof body
        .conversationId ===
        "string"
        ? body
            .conversationId
            .trim()
        : "";

    const forceStructuredBackfill =
      body
        .forceStructuredBackfill ===
      true;

    const {
      conversation,

      error:
        conversationError,
    } =
      await findConversation(
        supabase,

        user.id,

        requestedConversationId
      );

    if (
      conversationError ||
      !conversation
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation not found.",

          error:
            conversationError
              ?.message,
        },

        {
          status:
            404,
        }
      );
    }

    const existingStructuredItems =
      await loadStructuredItems(
        supabase,

        conversation.id,

        user.id
      );

    if (
      conversation
        .memory_enabled ===
      false
    ) {
      return NextResponse.json({
        ok:
          true,

        source:
          "memory_disabled",

        refreshed:
          false,

        newMessagesProcessed:
          0,

        memory:
          buildMemoryResponse(
            conversation,

            {
              structuredItems:
                existingStructuredItems,

              structuredMemorySource:
                "memory_disabled",
            }
          ),
      });
    }

    const allMessages =
      await loadConversationMessages(
        supabase,

        conversation.id,

        user.id
      );

    const totalMessageCount =
      allMessages.length;

    const previousSummaryMessageCount =
      Math.min(
        getSafeInteger(
          conversation
            .summary_message_count
        ),

        totalMessageCount
      );

    const newMessageRows =
      allMessages.slice(
        previousSummaryMessageCount
      );

    /*
     * حتی اگر پیام جدید وجود نداشته باشد،
     * در اولین اجرای حافظه ساختاریافته
     * Backfill انجام می‌شود.
     */
    if (
      newMessageRows.length ===
        0 &&
      existingStructuredItems.length >
        0 &&
      !forceStructuredBackfill
    ) {
      return NextResponse.json({
        ok:
          true,

        source:
          "memory_up_to_date",

        refreshed:
          false,

        newMessagesProcessed:
          0,

        memory:
          buildMemoryResponse(
            conversation,

            {
              structuredItems:
                existingStructuredItems,

              structuredMemorySource:
                "up_to_date",
            }
          ),
      });
    }

    const assistantMode =
      getSafeAssistantMode(
        conversation
          .assistant_mode
      );

    const previousBehaviorProfile:
      ConversationBehaviorProfile =
      normalizeBehaviorProfile(
        conversation
          .behavior_profile
      );

    let memoryResult:
      ConversationMemoryResult;

    let source:
      string;

    /*
     * اگر پیام جدید وجود داشته باشد،
     * خلاصه و پروفایل رفتاری به‌روز می‌شوند.
     *
     * اگر فقط Backfill حافظه ساختاریافته
     * لازم باشد، خلاصه قبلی حفظ می‌شود.
     */
    if (
      newMessageRows.length >
      0
    ) {
      const newMessages =
        toMemoryMessages(
          newMessageRows
        );

      if (
        process.env
          .MOCK_AI ===
        "true"
      ) {
        memoryResult =
          createMockMemoryResult({
            conversationTitle:
              conversation
                .title,

            assistantMode,

            previousSummary:
              conversation
                .conversation_summary ||
              "",

            previousBehaviorProfile,

            newMessages,

            totalMessageCount,
          });

        source =
          "mock";
      } else {
        const prompt =
          buildMemoryPrompt({
            conversationTitle:
              conversation
                .title,

            assistantMode,

            previousSummary:
              conversation
                .conversation_summary ||
              "",

            previousBehaviorProfile,

            newMessages,

            totalMessageCount,
          });

        const modelMessages:
          Message[] = [
          {
            role:
              "system",

            content:
              "شما موتور حافظه گفتگو هستید. فقط یک JSON معتبر و بدون Markdown تولید کنید.",
          },

          {
            role:
              "user",

            content:
              prompt,
          },
        ];

        try {
          const response =
            await getOpenRouterStream(
              modelMessages
            );

          if (
            !response.ok ||
            !response.body
          ) {
            throw new Error(
              "Memory model request failed."
            );
          }

          const modelText =
            await readStreamText(
              response.body
            );

          const parsedJson =
            extractJsonObject(
              modelText
            );

          memoryResult =
            parseMemoryResult(
              parsedJson
            );

          source =
            "ai";
        } catch (
          modelError
        ) {
          console.error(
            "Memory model error; using local fallback:",

            modelError
          );

          memoryResult =
            createMockMemoryResult({
              conversationTitle:
                conversation
                  .title,

              assistantMode,

              previousSummary:
                conversation
                  .conversation_summary ||
                "",

              previousBehaviorProfile,

              newMessages,

              totalMessageCount,
            });

          source =
            "local_fallback";
        }
      }
    } else {
      memoryResult = {
        summary:
          conversation
            .conversation_summary ||
          "",

        behaviorProfile:
          previousBehaviorProfile,
      };

      source =
        "structured_backfill";
    }

    const now =
      new Date()
        .toISOString();

    let updatedConversation:
      DbConversation =
      {
        ...conversation,
      };

    if (
      newMessageRows.length >
      0
    ) {
      const {
        data,

        error:
          updateError,
      } =
        await supabase
          .from(
            "conversations"
          )
          .update({
            conversation_summary:
              memoryResult
                .summary,

            summary_message_count:
              totalMessageCount,

            summary_updated_at:
              now,

            behavior_profile:
              memoryResult
                .behaviorProfile,

            behavior_profile_updated_at:
              now,
          })
          .eq(
            "id",

            conversation.id
          )
          .eq(
            "user_id",

            user.id
          )
          .select(
            `
            id,
            user_id,
            title,
            assistant_mode,
            conversation_summary,
            summary_message_count,
            summary_updated_at,
            behavior_profile,
            behavior_profile_updated_at,
            memory_enabled
            `
          )
          .single();

      if (
        updateError ||
        !data
      ) {
        return NextResponse.json(
          {
            ok:
              false,

            message:
              "Could not save conversation memory.",

            error:
              updateError
                ?.message,
          },

          {
            status:
              500,
          }
        );
      }

      updatedConversation =
        data as
          DbConversation;
    }

    const structuredResult =
      await refreshStructuredMemory({
        supabase,

        conversation:
          updatedConversation,

        userId:
          user.id,

        allMessages,

        previousSummaryMessageCount,

        summary:
          memoryResult
            .summary,

        behaviorProfile:
          memoryResult
            .behaviorProfile,

        forceBackfill:
          forceStructuredBackfill,
      });

    return NextResponse.json({
      ok:
        true,

      source,

      refreshed:
        newMessageRows.length >
          0 ||
        structuredResult
          .processedCount >
          0,

      newMessagesProcessed:
        newMessageRows
          .length,

      memory:
        buildMemoryResponse(
          updatedConversation,

          {
            structuredItems:
              structuredResult
                .items,

            structuredMemorySource:
              structuredResult
                .source,

            structuredMemoryProcessedCount:
              structuredResult
                .processedCount,
          }
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "Memory POST error:",

      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not refresh conversation memory.",

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