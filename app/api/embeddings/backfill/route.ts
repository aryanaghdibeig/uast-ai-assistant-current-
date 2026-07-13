// app/api/embeddings/backfill/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

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
   * اگر conversationId ارسال نشود،
   * آخرین گفتگوی فعال کاربر انتخاب می‌شود.
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
   POST
===================================================== */

export async function POST(
  request:
    NextRequest
) {
  try {
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