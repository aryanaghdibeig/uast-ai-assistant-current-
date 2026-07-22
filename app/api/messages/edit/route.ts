// app/api/messages/edit/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


/* =====================================================
   Types
===================================================== */

type MessageRole =
  | "user"
  | "assistant"
  | "system";


type MessageRow = {
  id:
    string;

  conversation_id:
    string;

  user_id:
    string;

  branch_id:
    string | null;

  role:
    MessageRole;

  content:
    string;

  created_at:
    string;
};


type ConversationRow = {
  id:
    string;

  title:
    string;

  active_branch_id:
    string | null;
};


type ConversationBranchRow = {
  id:
    string;

  conversation_id:
    string;

  user_id:
    string;

  title:
    string;

  branch_order:
    number;

  created_at:
    string;

  updated_at:
    string;
};


type BranchOrderRow = {
  branch_order:
    number;
};


type PreviousMessageRow = {
  role:
    MessageRole;

  content:
    string;

  created_at:
    string;
};


/* =====================================================
   Helpers
===================================================== */

function buildBranchTitle(
  content:
    string,

  branchOrder:
    number
) {
  const normalizedContent =
    content
      .replace(
        /\s+/g,

        " "
      )
      .trim();


  const contentPreview =
    normalizedContent.length >
    45
      ? `${normalizedContent.slice(
          0,

          45
        )}…`
      : normalizedContent;


  if (
    !contentPreview
  ) {
    return `شاخه ${branchOrder}`;
  }


  return `شاخه ${branchOrder}: ${contentPreview}`;
}


/* =====================================================
   PATCH Edited Message

   این مسیر:
   1. شاخه فعلی را حفظ می‌کند.
   2. یک شاخه جدید می‌سازد.
   3. پیام‌های قبل از پیام ویرایش‌شده را کپی می‌کند.
   4. شاخه جدید را فعال می‌کند.
   5. متن ویرایش‌شده را برای ارسال مجدد به چت برمی‌گرداند.
===================================================== */

export async function PATCH(
  req:
    NextRequest
) {
  try {
    /* ================================================
       1. Authentication
    ================================================= */

    const supabase =
      await createSupabaseServerClient();


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
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Unauthorized",
        },

        {
          status:
            401,
        }
      );
    }


    /* ================================================
       2. Read Request Body
    ================================================= */

    const body =
      await req
        .json()
        .catch(
          () => ({})
        );


    const messageId =
      typeof body.messageId ===
      "string"
        ? body.messageId.trim()
        : "";


    const conversationId =
      typeof body.conversationId ===
      "string"
        ? body.conversationId.trim()
        : "";


    const content =
      typeof body.content ===
      "string"
        ? body.content.trim()
        : "";


    /* ================================================
       3. Validate Request
    ================================================= */

    if (
      !messageId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Message id is required.",
        },

        {
          status:
            400,
        }
      );
    }


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


    if (
      !content
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Edited message content is required.",
        },

        {
          status:
            400,
        }
      );
    }


    /* ================================================
       4. Load Conversation
    ================================================= */

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
            active_branch_id
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
        .maybeSingle();


    if (
      conversationError
    ) {
      throw new Error(
        conversationError.message
      );
    }


    if (
      !conversationData
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


    const conversation =
      conversationData as
      ConversationRow;


    /* ================================================
       5. Load Original User Message
    ================================================= */

    const {
      data:
        messageData,

      error:
        messageError,
    } =
      await supabase
        .from(
          "messages"
        )
        .select(
          `
            id,
            conversation_id,
            user_id,
            branch_id,
            role,
            content,
            created_at
          `
        )
        .eq(
          "id",
          messageId
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (
      messageError
    ) {
      throw new Error(
        messageError.message
      );
    }


    if (
      !messageData
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Message not found or access denied.",
        },

        {
          status:
            404,
        }
      );
    }


    const originalMessage =
      messageData as
      MessageRow;


    if (
      originalMessage.role !==
      "user"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Only user messages can be edited.",
        },

        {
          status:
            400,
        }
      );
    }


    /* ================================================
       6. Resolve Source Branch
    ================================================= */

    const sourceBranchId =
      originalMessage.branch_id ||
      conversation.active_branch_id;


    if (
      !sourceBranchId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "The source conversation branch could not be identified.",
        },

        {
          status:
            409,
        }
      );
    }


    const {
      data:
        sourceBranchData,

      error:
        sourceBranchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id,
            user_id,
            title,
            branch_order,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          sourceBranchId
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (
      sourceBranchError
    ) {
      throw new Error(
        sourceBranchError.message
      );
    }


    if (
      !sourceBranchData
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "The source branch was not found or access was denied.",
        },

        {
          status:
            404,
        }
      );
    }


    const sourceBranch =
      sourceBranchData as
      ConversationBranchRow;


    /* ================================================
       7. Determine New Branch Order
    ================================================= */

    const {
      data:
        lastBranchData,

      error:
        lastBranchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          "branch_order"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "branch_order",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle();


    if (
      lastBranchError
    ) {
      throw new Error(
        lastBranchError.message
      );
    }


    const lastBranchOrder =
      (
        lastBranchData as
          BranchOrderRow |
          null
      )
        ?.branch_order ||
      0;


    const newBranchOrder =
      lastBranchOrder +
      1;


    const newBranchTitle =
      buildBranchTitle(
        content,

        newBranchOrder
      );


    const currentTimestamp =
      new Date()
        .toISOString();


    /* ================================================
       8. Create New Branch
    ================================================= */

    const {
      data:
        newBranchData,

      error:
        newBranchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .insert({
          conversation_id:
            conversationId,

          user_id:
            user.id,

          title:
            newBranchTitle,

          branch_order:
            newBranchOrder,

          created_at:
            currentTimestamp,

          updated_at:
            currentTimestamp,
        })
        .select(
          `
            id,
            conversation_id,
            user_id,
            title,
            branch_order,
            created_at,
            updated_at
          `
        )
        .single();


    if (
      newBranchError
    ) {
      throw new Error(
        newBranchError.message
      );
    }


    const newBranch =
      newBranchData as
      ConversationBranchRow;


    /* ================================================
       9. Load Messages Before Edited Message
    ================================================= */

    const {
      data:
        previousMessagesData,

      error:
        previousMessagesError,
    } =
      await supabase
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
          conversationId
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "branch_id",
          sourceBranchId
        )
        .lt(
          "created_at",
          originalMessage.created_at
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );


    if (
      previousMessagesError
    ) {
      await supabase
        .from(
          "conversation_branches"
        )
        .delete()
        .eq(
          "id",
          newBranch.id
        )
        .eq(
          "user_id",
          user.id
        );


      throw new Error(
        previousMessagesError.message
      );
    }


    const previousMessages =
      (
        previousMessagesData ||
        []
      ) as
      PreviousMessageRow[];


    /* ================================================
       10. Copy Previous Messages to New Branch
    ================================================= */

    if (
      previousMessages.length >
      0
    ) {
      const copiedMessages =
        previousMessages.map(
          (
            message
          ) => ({
            conversation_id:
              conversationId,

            user_id:
              user.id,

            branch_id:
              newBranch.id,

            role:
              message.role,

            content:
              message.content,

            created_at:
              message.created_at,
          })
        );


      const {
        error:
          copiedMessagesError,
      } =
        await supabase
          .from(
            "messages"
          )
          .insert(
            copiedMessages
          );


      if (
        copiedMessagesError
      ) {
        await supabase
          .from(
            "conversation_branches"
          )
          .delete()
          .eq(
            "id",
            newBranch.id
          )
          .eq(
            "user_id",
            user.id
          );


        throw new Error(
          copiedMessagesError.message
        );
      }
    }


    /* ================================================
       11. Activate New Branch
    ================================================= */

    const {
      error:
        activateBranchError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .update({
          active_branch_id:
            newBranch.id,

          updated_at:
            currentTimestamp,
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
      activateBranchError
    ) {
      await supabase
        .from(
          "conversation_branches"
        )
        .delete()
        .eq(
          "id",
          newBranch.id
        )
        .eq(
          "user_id",
          user.id
        );


      throw new Error(
        activateBranchError.message
      );
    }


    /* ================================================
       12. Final Response

       متن ویرایش‌شده هنوز در جدول messages ذخیره نمی‌شود.
       رابط کاربری باید آن را از مسیر معمول /api/chat
       ارسال کند تا پاسخ جدید در شاخه تازه ساخته شود.
    ================================================= */

    return NextResponse.json({
      ok:
        true,

      message:
        "A new conversation branch was created.",

      edit: {
        originalMessageId:
          originalMessage.id,

        conversationId,

        content,

        sourceBranch: {
          id:
            sourceBranch.id,

          title:
            sourceBranch.title,

          branchOrder:
            sourceBranch.branch_order,
        },

        newBranch: {
          id:
            newBranch.id,

          title:
            newBranch.title,

          branchOrder:
            newBranch.branch_order,

          isActive:
            true,
        },

        copiedMessageCount:
          previousMessages.length,

        readyToSend:
          true,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Message edit API error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not create a new conversation branch.",

        error:
          error instanceof Error
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