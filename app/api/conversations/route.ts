// app/api/conversations/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import type {
  AssistantModeId,
} from "@/types/chat";

import {
  isValidAssistantModeId,
} from "@/lib/assistant/prompts";


/* =====================================================
   Types
===================================================== */

type DbMessage = {
  id:
    string;

  conversation_id:
    string;

  branch_id:
    string | null;

  role:
    | "user"
    | "assistant"
    | "system";

  content:
    string;

  created_at:
    string;
};


type DbConversation = {
  id:
    string;

  title:
    string;

  assistant_mode:
    string;

  active_branch_id:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type DbConversationBranch = {
  id:
    string;

  conversation_id:
    string;

  branch_order:
    number;
};


type SerializedMessage = {
  id:
    string;

  role:
    | "user"
    | "assistant";

  content:
    string;

  createdAt:
    string;
};


/* =====================================================
   Helper Functions
===================================================== */

function getSafeAssistantMode(
  value:
    unknown
): AssistantModeId {
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


function serializeMessage(
  message:
    DbMessage
): SerializedMessage {
  return {
    id:
      message.id,

    role:
      message.role as
        | "user"
        | "assistant",

    content:
      message.content,

    createdAt:
      message.created_at,
  };
}


/**
 * برای گفتگوهایی که به هر دلیل active_branch_id ندارند،
 * اولین شاخه همان گفتگو را به‌عنوان شاخه جایگزین برمی‌گرداند.
 */
function buildInitialBranchMap(
  branches:
    DbConversationBranch[]
) {
  const initialBranchMap =
    new Map<
      string,
      string
    >();


  for (
    const branch of
    branches
  ) {
    if (
      !initialBranchMap.has(
        branch.conversation_id
      )
    ) {
      initialBranchMap.set(
        branch.conversation_id,

        branch.id
      );
    }
  }


  return initialBranchMap;
}


/* =====================================================
   GET Conversations
===================================================== */

export async function GET() {
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


    /* ================================================
       1. Load Conversations
    ================================================= */

    const {
      data:
        conversations,

      error:
        conversationsError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select(
          `
            id,
            title,
            assistant_mode,
            active_branch_id,
            created_at,
            updated_at
          `
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "updated_at",

          {
            ascending:
              false,
          }
        );


    if (
      conversationsError
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not load conversations.",

          error:
            conversationsError.message,
        },

        {
          status:
            500,
        }
      );
    }


    const conversationList =
      (
        conversations ||
        []
      ) as
      DbConversation[];


    const conversationIds =
      conversationList.map(
        (
          conversation
        ) =>
          conversation.id
      );


    if (
      conversationIds.length ===
      0
    ) {
      return NextResponse.json({
        ok:
          true,

        conversations:
          [],
      });
    }


    /* ================================================
       2. Load Conversation Branches

       این بخش برای پشتیبانی از گفتگوهای قدیمی یا
       گفتگوهایی است که active_branch_id آن‌ها خالی باشد.
    ================================================= */

    const {
      data:
        branches,

      error:
        branchesError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id,
            branch_order
          `
        )
        .in(
          "conversation_id",
          conversationIds
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "branch_order",

          {
            ascending:
              true,
          }
        );


    if (
      branchesError
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not load conversation branches.",

          error:
            branchesError.message,
        },

        {
          status:
            500,
        }
      );
    }


    const branchList =
      (
        branches ||
        []
      ) as
      DbConversationBranch[];


    const initialBranchMap =
      buildInitialBranchMap(
        branchList
      );


    /* ================================================
       3. Load Messages

       همه پیام‌ها در یک Query دریافت می‌شوند؛
       اما هنگام ساخت خروجی، فقط پیام‌های شاخه فعال
       هر گفتگو انتخاب خواهند شد.
    ================================================= */

    const {
      data:
        messages,

      error:
        messagesError,
    } =
      await supabase
        .from(
          "messages"
        )
        .select(
          `
            id,
            conversation_id,
            branch_id,
            role,
            content,
            created_at
          `
        )
        .in(
          "conversation_id",
          conversationIds
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",

          {
            ascending:
              true,
          }
        );


    if (
      messagesError
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not load messages.",

          error:
            messagesError.message,
        },

        {
          status:
            500,
        }
      );
    }


    const messageList =
      (
        messages ||
        []
      ) as
      DbMessage[];


    /* ================================================
       4. Build Conversations with Active Branch Messages
    ================================================= */

    const conversationsWithMessages =
      conversationList.map(
        (
          conversation
        ) => {
          /**
           * اولویت:
           * 1. شاخه فعال ثبت‌شده در conversations
           * 2. اولین شاخه موجود برای گفتگو
           * 3. null برای سازگاری با داده‌های بسیار قدیمی
           */
          const effectiveActiveBranchId =
            conversation
              .active_branch_id ||

            initialBranchMap.get(
              conversation.id
            ) ||

            null;


          const conversationMessages =
            messageList
              .filter(
                (
                  message
                ) =>
                  message
                    .conversation_id ===
                  conversation.id
              )
              .filter(
                (
                  message
                ) => {
                  /**
                   * در حالت عادی فقط پیام‌های شاخه فعال
                   * نمایش داده می‌شوند.
                   */
                  if (
                    effectiveActiveBranchId
                  ) {
                    return (
                      message.branch_id ===
                      effectiveActiveBranchId
                    );
                  }


                  /**
                   * سازگاری با پیام‌های قدیمی که هنوز
                   * branch_id ندارند.
                   */
                  return (
                    message.branch_id ===
                    null
                  );
                }
              )
              .filter(
                (
                  message
                ) =>
                  message.role ===
                    "user" ||

                  message.role ===
                    "assistant"
              )
              .map(
                serializeMessage
              );


          return {
            id:
              conversation.id,

            title:
              conversation.title,

            assistantMode:
              getSafeAssistantMode(
                conversation
                  .assistant_mode
              ),

            activeBranchId:
              effectiveActiveBranchId,

            messages:
              conversationMessages,
          };
        }
      );


    return NextResponse.json({
      ok:
        true,

      conversations:
        conversationsWithMessages,
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation GET error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Conversation GET failed.",

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


/* =====================================================
   POST Conversation
===================================================== */

export async function POST(
  req:
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
      await req
        .json()
        .catch(
          () => ({})
        );


    const title =
      typeof body.title ===
        "string" &&

      body.title.trim()
        ? body.title.trim()
        : "گفتگوی جدید";


    const assistantMode =
      getSafeAssistantMode(
        body.assistantMode
      );


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .insert({
          user_id:
            user.id,

          title,

          assistant_mode:
            assistantMode,
        })
        .select(
          `
            id,
            title,
            assistant_mode,
            created_at,
            updated_at
          `
        )
        .single();


    if (
      error
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not create conversation.",

          error:
            error.message,
        },

        {
          status:
            500,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      conversation: {
        id:
          data.id,

        title:
          data.title,

        assistantMode:
          getSafeAssistantMode(
            data.assistant_mode
          ),

        messages:
          [],
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation POST error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Conversation POST failed.",

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


/* =====================================================
   PATCH Conversation
===================================================== */

export async function PATCH(
  req:
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
      await req
        .json()
        .catch(
          () => ({})
        );


    const conversationId =
      typeof body
        .conversationId ===
        "string"
        ? body
          .conversationId
          .trim()
        : "";


    const assistantMode =
      getSafeAssistantMode(
        body.assistantMode
      );


    if (
      !conversationId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation id is required.",
        },

        {
          status:
            400,
        }
      );
    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .update({
          assistant_mode:
            assistantMode,

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
        )
        .select(
          `
            id,
            title,
            assistant_mode,
            created_at,
            updated_at
          `
        )
        .single();


    if (
      error
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not update conversation mode.",

          error:
            error.message,
        },

        {
          status:
            500,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      conversation: {
        id:
          data.id,

        title:
          data.title,

        assistantMode:
          getSafeAssistantMode(
            data.assistant_mode
          ),
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation PATCH error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Conversation PATCH failed.",

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


/* =====================================================
   DELETE Conversation
===================================================== */

export async function DELETE(
  req:
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
      req.nextUrl
        .searchParams
        .get(
          "id"
        )
        ?.trim() ||

      "";


    if (
      !conversationId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation id is required.",
        },

        {
          status:
            400,
        }
      );
    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .delete()
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .select(
          "id"
        );


    if (
      error
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Could not delete conversation.",

          error:
            error.message,
        },

        {
          status:
            500,
        }
      );
    }


    if (
      !data ||
      data.length ===
        0
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation not found or access denied.",
        },

        {
          status:
            404,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      message:
        "Conversation deleted.",

      deletedConversationId:
        conversationId,
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation DELETE error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Conversation DELETE failed.",

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