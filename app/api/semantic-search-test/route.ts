// app/api/semantic-search-test/route.ts

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
  buildSemanticMemoryContext,
  searchConversationSemanticMemory,
} from "@/lib/assistant/semanticMemory";


export const runtime =
  "nodejs";


type ConversationRow = {
  id:
    string;

  title:
    string;
};


/* =====================================================
   Find conversation
===================================================== */

async function findConversation(
  input: {
    supabase:
      Awaited<
        ReturnType<
          typeof createSupabaseServerClient
        >
      >;

    userId:
      string;

    conversationId:
      string;
  }
):
  Promise<
    ConversationRow | null
  > {
  if (
    input.conversationId
  ) {
    const {
      data,

      error,
    } =
      await input
        .supabase
        .from(
          "conversations"
        )
        .select(
          "id,title"
        )
        .eq(
          "id",

          input
            .conversationId
        )
        .eq(
          "user_id",

          input.userId
        )
        .maybeSingle();


    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }


    return (
      data ||
      null
    ) as
      ConversationRow |
      null;
  }


  /**
   * اگر شناسه گفتگو ارسال نشود،
   * آخرین گفتگوی کاربر انتخاب می‌شود.
   */
  const {
    data,

    error,
  } =
    await input
      .supabase
      .from(
        "conversations"
      )
      .select(
        "id,title"
      )
      .eq(
        "user_id",

        input.userId
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


  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }


  return (
    data ||
    null
  ) as
    ConversationRow |
    null;
}


/* =====================================================
   GET
===================================================== */

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


    const query =
      request
        .nextUrl
        .searchParams
        .get(
          "q"
        )
        ?.trim() ||

      "پژوهش سازمان";


    const conversationId =
      request
        .nextUrl
        .searchParams
        .get(
          "conversationId"
        )
        ?.trim() ||

      "";


    const conversation =
      await findConversation({
        supabase,

        userId:
          user.id,

        conversationId,
      });


    if (
      !conversation
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Conversation not found.",
        },

        {
          status:
            404,
        }
      );
    }


    const semanticResult =
      await searchConversationSemanticMemory({
        supabase,

        conversationId:
          conversation.id,

        userId:
          user.id,

        query,

        matchCount:
          6,
      });


    const promptContext =
      buildSemanticMemoryContext(
        semanticResult
          .matches
      );


    return NextResponse.json({
      ok:
        true,

      message:
        "Semantic conversation memory is working.",

      conversation: {
        id:
          conversation.id,

        title:
          conversation.title,
      },

      result:
        semanticResult,

      promptContext,
    });
  } catch (
    error
  ) {
    console.error(
      "Semantic-search test error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Semantic-search test failed.",

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