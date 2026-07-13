// lib/assistant/messageEmbeddings.ts

import {
  createEmbeddingContentHash,
  createEmbeddings,
  getEmbeddingConfiguration,
  isMockEmbeddingEnabled,
  normalizeEmbeddingText,
} from "@/lib/assistant/embeddings";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


/* =====================================================
   Types
===================================================== */

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;


type MessageEmbeddingRow = {
  id:
    string;

  conversation_id:
    string;

  user_id:
    string;

  role:
    "user" |
    "assistant" |
    "system";

  content:
    string;

  created_at:
    string;

  embedding_model:
    string | null;

  embedding_dimensions:
    number | null;

  embedding_content_hash:
    string | null;

  embedded_at:
    string | null;
};


type PreparedMessage = {
  row:
    MessageEmbeddingRow;

  normalizedText:
    string;

  contentHash:
    string;
};


type FailedMessage = {
  messageId:
    string;

  error:
    string;
};


export type BackfillMessageEmbeddingsOptions = {
  supabase:
    SupabaseServerClient;

  conversationId:
    string;

  userId:
    string;

  batchSize?:
    number;

  force?:
    boolean;
};


export type BackfillMessageEmbeddingsResult = {
  conversationId:
    string;

  source:
    "mock" |
    "openrouter" |
    "none";

  model:
    string;

  dimensions:
    number;

  batchSize:
    number;

  scannedMessages:
    number;

  processedCount:
    number;

  failedCount:
    number;

  hasMore:
    boolean;

  force:
    boolean;

  processedMessages:
    Array<{
      id:
        string;

      role:
        string;

      preview:
        string;
    }>;

  failedMessages:
    FailedMessage[];
};


/* =====================================================
   Constants
===================================================== */

/**
 * تعداد پیام‌هایی که در هر صفحه
 * از Supabase خوانده می‌شوند.
 */
const MESSAGE_SCAN_PAGE_SIZE =
  200;


/**
 * برای جلوگیری از طولانی‌شدن
 * Route در محیط Serverless.
 */
const DEFAULT_BATCH_SIZE =
  20;


const MAX_BATCH_SIZE =
  50;


/**
 * پیام‌های بسیار کوتاه معمولاً
 * ارزش معنایی مستقلی ندارند.
 */
const MIN_EMBEDDING_TEXT_LENGTH =
  2;


/* =====================================================
   Helpers
===================================================== */

function clampBatchSize(
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
    return DEFAULT_BATCH_SIZE;
  }


  return Math.min(
    MAX_BATCH_SIZE,

    Math.max(
      1,

      Math.floor(
        numericValue
      )
    )
  );
}


function getExpectedStoredModel() {
  if (
    isMockEmbeddingEnabled()
  ) {
    return "mock-hashed-embedding-v1";
  }


  return getEmbeddingConfiguration()
    .model;
}


function createPreview(
  content:
    string
) {
  const normalized =
    normalizeEmbeddingText(
      content
    );


  if (
    normalized.length <=
    90
  ) {
    return normalized;
  }


  return `${normalized.slice(
    0,
    90
  )}...`;
}


function needsEmbedding(
  preparedMessage:
    PreparedMessage,

  expectedModel:
    string,

  expectedDimensions:
    number,

  force:
    boolean
) {
  if (
    force
  ) {
    return true;
  }


  const {
    row,

    contentHash,
  } =
    preparedMessage;


  /**
   * اگر مدل تغییر کند،
   * Embedding دوباره ساخته می‌شود.
   *
   * بنابراین هنگام تغییر:
   *
   * MOCK_EMBEDDINGS=true
   *
   * به:
   *
   * MOCK_EMBEDDINGS=false
   *
   * بردارهای Mock به‌صورت خودکار
   * با بردار واقعی جایگزین می‌شوند.
   */
  if (
    row.embedding_model !==
    expectedModel
  ) {
    return true;
  }


  if (
    row.embedding_dimensions !==
    expectedDimensions
  ) {
    return true;
  }


  if (
    row.embedding_content_hash !==
    contentHash
  ) {
    return true;
  }


  if (
    !row.embedded_at
  ) {
    return true;
  }


  return false;
}


/* =====================================================
   Load pending messages
===================================================== */

async function loadPendingMessages(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    batchSize:
      number;

    force:
      boolean;

    expectedModel:
      string;

    expectedDimensions:
      number;
  }
) {
  const pendingMessages:
    PreparedMessage[] =
    [];


  let offset =
    0;


  let scannedMessages =
    0;


  let reachedEnd =
    false;


  /**
   * یک پیام اضافه‌تر پیدا می‌کنیم
   * تا بفهمیم بعد از این Batch
   * هنوز پیام دیگری باقی مانده است یا نه.
   */
  const targetCandidateCount =
    input.batchSize +
    1;


  while (
    pendingMessages.length <
      targetCandidateCount &&
    !reachedEnd
  ) {
    const rangeEnd =
      offset +
      MESSAGE_SCAN_PAGE_SIZE -
      1;


    const {
      data,

      error,
    } =
      await input
        .supabase
        .from(
          "messages"
        )
        .select(
          `
          id,
          conversation_id,
          user_id,
          role,
          content,
          created_at,
          embedding_model,
          embedding_dimensions,
          embedding_content_hash,
          embedded_at
          `
        )
        .eq(
          "conversation_id",

          input.conversationId
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
        )
        .range(
          offset,

          rangeEnd
        );


    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }


    const rows =
      (
        data ||
        []
      ) as
        MessageEmbeddingRow[];


    scannedMessages +=
      rows.length;


    if (
      rows.length <
      MESSAGE_SCAN_PAGE_SIZE
    ) {
      reachedEnd =
        true;
    }


    for (
      const row of
      rows
    ) {
      const normalizedText =
        normalizeEmbeddingText(
          row.content
        );


      if (
        normalizedText.length <
        MIN_EMBEDDING_TEXT_LENGTH
      ) {
        continue;
      }


      const contentHash =
        createEmbeddingContentHash(
          normalizedText
        );


      const preparedMessage:
        PreparedMessage = {
        row,

        normalizedText,

        contentHash,
      };


      if (
        needsEmbedding(
          preparedMessage,

          input.expectedModel,

          input.expectedDimensions,

          input.force
        )
      ) {
        pendingMessages.push(
          preparedMessage
        );
      }


      if (
        pendingMessages.length >=
        targetCandidateCount
      ) {
        break;
      }
    }


    offset +=
      MESSAGE_SCAN_PAGE_SIZE;
  }


  const hasMore =
    pendingMessages.length >
    input.batchSize;


  return {
    messages:
      pendingMessages.slice(
        0,

        input.batchSize
      ),

    hasMore,

    scannedMessages,
  };
}


/* =====================================================
   Save one embedding
===================================================== */

async function saveMessageEmbedding(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    conversationId:
      string;

    message:
      PreparedMessage;

    embedding:
      number[];

    model:
      string;

    dimensions:
      number;
  }
) {
  const {
    error,
  } =
    await input
      .supabase
      .from(
        "messages"
      )
      .update({
        embedding:
          input.embedding,

        embedding_model:
          input.model,

        embedding_dimensions:
          input.dimensions,

        embedding_content_hash:
          input
            .message
            .contentHash,

        embedded_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",

        input
          .message
          .row
          .id
      )
      .eq(
        "conversation_id",

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


/* =====================================================
   Public backfill function
===================================================== */

export async function backfillMessageEmbeddings(
  options:
    BackfillMessageEmbeddingsOptions
):
  Promise<
    BackfillMessageEmbeddingsResult
  > {
  const configuration =
    getEmbeddingConfiguration();


  const batchSize =
    clampBatchSize(
      options.batchSize
    );


  const force =
    options.force ===
    true;


  const expectedModel =
    getExpectedStoredModel();


  const pendingResult =
    await loadPendingMessages({
      supabase:
        options.supabase,

      conversationId:
        options.conversationId,

      userId:
        options.userId,

      batchSize,

      force,

      expectedModel,

      expectedDimensions:
        configuration
          .dimensions,
    });


  /**
   * اگر همه پیام‌ها Embedding دارند،
   * بدون درخواست اضافی برمی‌گردیم.
   */
  if (
    pendingResult
      .messages
      .length ===
    0
  ) {
    return {
      conversationId:
        options
          .conversationId,

      source:
        "none",

      model:
        expectedModel,

      dimensions:
        configuration
          .dimensions,

      batchSize,

      scannedMessages:
        pendingResult
          .scannedMessages,

      processedCount:
        0,

      failedCount:
        0,

      hasMore:
        false,

      force,

      processedMessages:
        [],

      failedMessages:
        [],
    };
  }


  /**
   * تمام متن‌های این Batch
   * در یک درخواست Embedding
   * پردازش می‌شوند.
   */
  const embeddingResults =
    await createEmbeddings(
      pendingResult
        .messages
        .map(
          (
            message
          ) =>
            message
              .normalizedText
        ),

      {
        inputType:
          "search_document",
      }
    );


  if (
    embeddingResults.length !==
    pendingResult
      .messages
      .length
  ) {
    throw new Error(
      "Embedding result count does not match message count."
    );
  }


  const processedMessages:
    BackfillMessageEmbeddingsResult[
      "processedMessages"
    ] =
    [];


  const failedMessages:
    FailedMessage[] =
    [];


  /**
   * ذخیره پیام‌ها به‌صورت موازی
   * انجام می‌شود.
   */
  await Promise.all(
    pendingResult
      .messages
      .map(
        async (
          message,

          index
        ) => {
          const embeddingResult =
            embeddingResults[
              index
            ];


          try {
            await saveMessageEmbedding({
              supabase:
                options
                  .supabase,

              userId:
                options
                  .userId,

              conversationId:
                options
                  .conversationId,

              message,

              embedding:
                embeddingResult
                  .embedding,

              model:
                embeddingResult
                  .model,

              dimensions:
                embeddingResult
                  .dimensions,
            });


            processedMessages.push({
              id:
                message
                  .row
                  .id,

              role:
                message
                  .row
                  .role,

              preview:
                createPreview(
                  message
                    .row
                    .content
                ),
            });
          } catch (
            error
          ) {
            failedMessages.push({
              messageId:
                message
                  .row
                  .id,

              error:
                error instanceof
                Error
                  ? error.message
                  : "Unknown error",
            });
          }
        }
      )
  );


  return {
    conversationId:
      options
        .conversationId,

    source:
      embeddingResults[
        0
      ]?.source ||
      "none",

    model:
      embeddingResults[
        0
      ]?.model ||
      expectedModel,

    dimensions:
      configuration
        .dimensions,

    batchSize,

    scannedMessages:
      pendingResult
        .scannedMessages,

    processedCount:
      processedMessages
        .length,

    failedCount:
      failedMessages
        .length,

    hasMore:
      pendingResult
        .hasMore,

    force,

    processedMessages,

    failedMessages,
  };
}