// app/api/embeddings/backfill/route.ts

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
  getOwnedConversation,
  getLatestOwnedConversation,
} from "@/lib/conversations/ownership";

import {
  backfillMessageEmbeddings,
} from "@/lib/assistant/messageEmbeddings";


export const runtime =
  "nodejs";


type ConversationRow = {
  id:
    string;

  title:
    string;
};


/* =====================================================
   Helpers
===================================================== */

function getSafeBatchSize(
  value:
    unknown
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
    return 20;
  }


  return Math.min(
    50,

    Math.max(
      1,

      Math.floor(
        numericValue
      )
    )
  );
}


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
      conversation,

      error,
    } =
      await getOwnedConversation<
        ConversationRow
      >({
        supabase:
          input.supabase,

        userId:
          input.userId,

        conversationId:
          input.conversationId,

        select:
          "id,title",
      });


    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }


    return conversation;
  }


  /**
   * اگر conversationId ارسال نشود،
   * آخرین گفتگوی فعال کاربر انتخاب می‌شود.
   */
  const {
    conversation,

    error,
  } =
    await getLatestOwnedConversation<
      ConversationRow
    >({
      supabase:
        input.supabase,

      userId:
        input.userId,

      select:
        "id,title",
    });


  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }


  return conversation;
}


/* =====================================================
   POST
===================================================== */

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


    const conversationId =
      typeof body
        .conversationId ===
        "string"
        ? body
            .conversationId
            .trim()
        : "";


    const batchSize =
      getSafeBatchSize(
        body.batchSize
      );


    const force =
      body.force ===
      true;


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


    const result =
      await backfillMessageEmbeddings({
        supabase,

        conversationId:
          conversation.id,

        userId:
          user.id,

        batchSize,

        force,
      });


    return NextResponse.json({
      ok:
        true,

      message:
        result.processedCount >
        0
          ? "Message embeddings were generated and saved."
          : "All eligible messages already have current embeddings.",

      conversation: {
        id:
          conversation.id,

        title:
          conversation.title,
      },

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "Embedding backfill error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Embedding backfill failed.",

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
