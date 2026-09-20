// app/api/embeddings/backfill-all/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  backfillMessageEmbeddings,
} from "@/lib/assistant/messageEmbeddings";


export const runtime = "nodejs";

export const dynamic = "force-dynamic";


/* =====================================================
   Types
===================================================== */

type ConversationRow = {
  id: string;

  title: string;

  updated_at: string;
};


type ConversationBackfillSummary = {
  id: string;

  title: string;

  attempts: number;

  scannedMessages: number;

  processedCount: number;

  failedCount: number;

  hasMore: boolean;

  source:
    | "mock"
    | "openrouter"
    | "none";

  model: string;
};


/* =====================================================
   Constants
===================================================== */

/**
 * تعداد پیام‌های پردازش‌شده
 * در هر Batch.
 */
const DEFAULT_BATCH_SIZE = 20;

const MAX_BATCH_SIZE = 50;


/**
 * حداکثر تعداد Batch واقعی
 * در هر درخواست.
 *
 * این محدودیت از طولانی‌شدن
 * بیش از حد یک درخواست جلوگیری می‌کند.
 */
const DEFAULT_MAX_WORK_BATCHES = 5;

const MAX_WORK_BATCHES = 20;


/**
 * سقف تعداد گفتگوهای قابل بررسی
 * برای یک کاربر.
 */
const MAX_CONVERSATIONS = 500;


/* =====================================================
   Helpers
===================================================== */

function clampInteger(
  value: unknown,

  minimum: number,

  maximum: number,

  fallback: number
) {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return fallback;
  }


  return Math.min(
    maximum,

    Math.max(
      minimum,

      Math.floor(
        numericValue
      )
    )
  );
}


/* =====================================================
   POST
===================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    /* -------------------------------------------------
       1–2. Supabase session (authenticated)
    -------------------------------------------------- */

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


    /* -------------------------------------------------
       3. Request settings
    -------------------------------------------------- */

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const batchSize =
      clampInteger(
        body.batchSize,

        1,

        MAX_BATCH_SIZE,

        DEFAULT_BATCH_SIZE
      );


    const maxWorkBatches =
      clampInteger(
        body.maxWorkBatches,

        1,

        MAX_WORK_BATCHES,

        DEFAULT_MAX_WORK_BATCHES
      );


    /* -------------------------------------------------
       4. Load all user conversations
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
          "id,title,updated_at"
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
        )
        .limit(
          MAX_CONVERSATIONS
        );


    if (
      conversationError
    ) {
      throw new Error(
        conversationError.message
      );
    }


    const conversations =
      (
        conversationData ||
        []
      ) as
        ConversationRow[];


    if (
      conversations.length ===
      0
    ) {
      return NextResponse.json({
        ok: true,

        message:
          "No conversations were found.",

        result: {
          conversationCount:
            0,

          conversationsScanned:
            0,

          workBatches:
            0,

          processedCount:
            0,

          failedCount:
            0,

          hasMore:
            false,

          conversations:
            [],
        },
      });
    }


    /* -------------------------------------------------
       5. Backfill all conversations
    -------------------------------------------------- */

    const summaries:
      ConversationBackfillSummary[] =
      [];


    let totalProcessed =
      0;


    let totalFailed =
      0;


    let totalScannedMessages =
      0;


    let workBatches =
      0;


    let conversationsScanned =
      0;


    let hasMore =
      false;


    let stopProcessing =
      false;


    for (
      let conversationIndex = 0;

      conversationIndex <
      conversations.length;

      conversationIndex++
    ) {
      const conversation =
        conversations[
          conversationIndex
        ];


      let attempts =
        0;


      let conversationScannedMessages =
        0;


      let conversationProcessed =
        0;


      let conversationFailed =
        0;


      let conversationHasMore =
        false;


      let conversationSource:
        ConversationBackfillSummary[
          "source"
        ] =
        "none";


      let conversationModel =
        "";


      /*
       * هر گفتگو تا زمانی پردازش می‌شود
       * که:
       *
       * 1. پیام عقب‌مانده‌ای نداشته باشد
       *
       * یا
       *
       * 2. سقف Batchهای این درخواست
       * تکمیل شود.
       */
      while (
        true
      ) {
        const result =
          await backfillMessageEmbeddings({
            supabase,

            conversationId:
              conversation.id,

            userId:
              user.id,

            batchSize,

            force:
              false,
          });


        attempts++;


        conversationScannedMessages +=
          result.scannedMessages;


        conversationProcessed +=
          result.processedCount;


        conversationFailed +=
          result.failedCount;


        conversationHasMore =
          result.hasMore;


        if (
          result.source !==
          "none"
        ) {
          conversationSource =
            result.source;
        }


        if (
          result.model
        ) {
          conversationModel =
            result.model;
        }


        const batchPerformedWork =
          result.processedCount >
            0 ||

          result.failedCount >
            0 ||

          result.hasMore;


        if (
          batchPerformedWork
        ) {
          workBatches++;
        }


        /*
         * اگر خطایی وجود داشته باشد،
         * در اجرای بعد دوباره تلاش می‌شود.
         */
        if (
          result.failedCount >
          0
        ) {
          hasMore =
            true;
        }


        /*
         * این گفتگو تمام شده است.
         */
        if (
          !result.hasMore
        ) {
          break;
        }


        /*
         * سقف کار این درخواست
         * تکمیل شده است.
         */
        if (
          workBatches >=
          maxWorkBatches
        ) {
          hasMore =
            true;

          stopProcessing =
            true;

          break;
        }
      }


      summaries.push({
        id:
          conversation.id,

        title:
          conversation.title,

        attempts,

        scannedMessages:
          conversationScannedMessages,

        processedCount:
          conversationProcessed,

        failedCount:
          conversationFailed,

        hasMore:
          conversationHasMore,

        source:
          conversationSource,

        model:
          conversationModel,
      });


      conversationsScanned++;


      totalScannedMessages +=
        conversationScannedMessages;


      totalProcessed +=
        conversationProcessed;


      totalFailed +=
        conversationFailed;


      /*
       * ممکن است گفتگوی فعلی تمام شده باشد،
       * اما هنوز گفتگوهای دیگری باقی باشند.
       */
      if (
        workBatches >=
          maxWorkBatches &&

        conversationIndex <
          conversations.length -
            1
      ) {
        hasMore =
          true;

        stopProcessing =
          true;
      }


      if (
        stopProcessing
      ) {
        break;
      }
    }


    /* -------------------------------------------------
       6. Response
    -------------------------------------------------- */

    return NextResponse.json({
      ok: true,

      message:
        totalProcessed >
        0
          ? "Embeddings were generated for old conversation messages."
          : hasMore
            ? "This backfill round finished and more work remains."
            : "All eligible messages already have current embeddings.",

      result: {
        conversationCount:
          conversations.length,

        conversationsScanned,

        totalScannedMessages,

        workBatches,

        batchSize,

        maxWorkBatches,

        processedCount:
          totalProcessed,

        failedCount:
          totalFailed,

        hasMore,

        conversations:
          summaries,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Backfill all embeddings error:",

      error
    );


    return NextResponse.json(
      {
        ok: false,

        message:
          "Backfill all embeddings failed.",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown error",
      },

      {
        status: 500,
      }
    );
  }
}