// app/api/conversations/[conversationId]/branches/route.ts

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


type RouteContext = {
  params:
    Promise<{
      conversationId:
        string;
    }>;
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

  title:
    string;

  branch_order:
    number;

  created_at:
    string;

  updated_at:
    string;
};


async function getAuthenticatedUser() {
  const supabase =
    await createSupabaseServerClient();


  const {
    data: {
      user,
    },

    error,
  } =
    await supabase
      .auth
      .getUser();


  return {
    supabase,
    user,
    error,
  };
}


async function getConversationId(
  context:
    RouteContext
) {
  const {
    conversationId,
  } =
    await context.params;


  return conversationId
    .trim();
}


function serializeBranch(
  branch:
    ConversationBranchRow,

  activeBranchId:
    string | null
) {
  return {
    id:
      branch.id,

    conversationId:
      branch.conversation_id,

    title:
      branch.title,

    branchOrder:
      branch.branch_order,

    isActive:
      branch.id ===
      activeBranchId,

    createdAt:
      branch.created_at,

    updatedAt:
      branch.updated_at,
  };
}


/**
 * دریافت فهرست شاخه‌های یک گفتگو
 */
export async function GET(
  _request:
    NextRequest,

  context:
    RouteContext
) {
  try {
    const {
      supabase,
      user,
      error:
        userError,
    } =
      await getAuthenticatedUser();


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


    const conversationId =
      await getConversationId(
        context
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


    const {
      data:
        branchData,

      error:
        branchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id,
            title,
            branch_order,
            created_at,
            updated_at
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
        .order(
          "branch_order",
          {
            ascending:
              true,
          }
        );


    if (
      branchError
    ) {
      throw new Error(
        branchError.message
      );
    }


    const branches =
      (
        branchData ||
        []
      ) as
      ConversationBranchRow[];


    const effectiveActiveBranchId =
      conversation.active_branch_id ||
      branches[0]?.id ||
      null;


    const serializedBranches =
      branches.map(
        (
          branch
        ) =>
          serializeBranch(
            branch,

            effectiveActiveBranchId
          )
      );


    const activeBranchIndex =
      serializedBranches.findIndex(
        (
          branch
        ) =>
          branch.isActive
      );


    return NextResponse.json({
      ok:
        true,

      conversation: {
        id:
          conversation.id,

        title:
          conversation.title,

        activeBranchId:
          effectiveActiveBranchId,
      },

      branches:
        serializedBranches,

      branchCount:
        serializedBranches.length,

      activeBranchPosition:
        activeBranchIndex >=
        0
          ? activeBranchIndex +
            1
          : 0,
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation branches GET error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load conversation branches.",

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


/**
 * انتخاب و فعال‌کردن یکی از شاخه‌های گفتگو
 */
export async function PATCH(
  request:
    NextRequest,

  context:
    RouteContext
) {
  try {
    const {
      supabase,
      user,
      error:
        userError,
    } =
      await getAuthenticatedUser();


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


    const conversationId =
      await getConversationId(
        context
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


    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const branchId =
      typeof body.branchId ===
        "string"
        ? body.branchId.trim()
        : "";


    if (
      !branchId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Branch id is required.",
        },

        {
          status:
            400,
        }
      );
    }


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


    const {
      data:
        branchData,

      error:
        branchError,
    } =
      await supabase
        .from(
          "conversation_branches"
        )
        .select(
          `
            id,
            conversation_id,
            title,
            branch_order,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          branchId
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
      branchError
    ) {
      throw new Error(
        branchError.message
      );
    }


    if (
      !branchData
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Branch not found or access denied.",
        },

        {
          status:
            404,
        }
      );
    }


    const {
      data:
        updatedConversation,

      error:
        updateError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .update({
          active_branch_id:
            branchId,

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
            active_branch_id
          `
        )
        .single();


    if (
      updateError
    ) {
      throw new Error(
        updateError.message
      );
    }


    const selectedBranch =
      branchData as
      ConversationBranchRow;


    return NextResponse.json({
      ok:
        true,

      message:
        "Active conversation branch updated.",

      conversation: {
        id:
          updatedConversation.id,

        title:
          updatedConversation.title,

        activeBranchId:
          updatedConversation.active_branch_id,
      },

      activeBranch:
        serializeBranch(
          selectedBranch,

          updatedConversation.active_branch_id
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "Conversation branches PATCH error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not update the active conversation branch.",

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