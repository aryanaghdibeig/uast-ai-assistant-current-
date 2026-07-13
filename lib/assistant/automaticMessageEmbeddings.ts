// lib/assistant/automaticMessageEmbeddings.ts

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


export type NewMessageEmbeddingInput = {
  id:
    string;

  role:
    "user" |
    "assistant";

  content:
    string;
};


type ExistingMessageEmbeddingRow = {
  id:
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
  id:
    string;

  role:
    "user" |
    "assistant";

  originalContent:
    string;

  normalizedText:
    string;

  contentHash:
    string;
};


export type AutomaticMessageEmbeddingResult = {
  source:
    "mock" |
    "openrouter" |
    "none";

  model:
    string;

  dimensions:
    number;

  receivedCount:
    number;

  eligibleCount:
    number;

  processedCount:
    number;

  skippedCount:
    number;

  failedCount:
    number;

  processedMessageIds:
    string[];

  skippedMessageIds:
    string[];

  failedMessages:
    Array<{
      id:
        string;

      error:
        string;
    }>;
};


type EmbedNewMessagesOptions = {
  supabase:
    SupabaseServerClient;

  conversationId:
    string;

  userId:
    string;

  messages:
    NewMessageEmbeddingInput[];
};


/* =====================================================
   Constants
===================================================== */

const MIN_TEXT_LENGTH =
  2;


const MAX_MESSAGES_PER_REQUEST =
  10;


/* =====================================================
   Helpers
===================================================== */

function getExpectedEmbeddingModel() {
  if (
    isMockEmbeddingEnabled()
  ) {
    return "mock-hashed-embedding-v1";
  }


  return getEmbeddingConfiguration()
    .model;
}


function removeDuplicateMessages(
  messages:
    NewMessageEmbeddingInput[]
) {
  const uniqueMessages =
    new Map<
      string,
      NewMessageEmbeddingInput
    >();


  for (
    const message of
      messages
  ) {
    if (
      !message.id
    ) {
      continue;
    }


    uniqueMessages.set(
      message.id,

      message
    );
  }


  return Array.from(
    uniqueMessages.values()
  );
}


function prepareMessages(
  messages:
    NewMessageEmbeddingInput[]
) {
  const preparedMessages:
    PreparedMessage[] =
    [];


  for (
    const message of
      messages
  ) {
    const normalizedText =
      normalizeEmbeddingText(
        message.content
      );


    if (
      normalizedText.length <
      MIN_TEXT_LENGTH
    ) {
      continue;
    }


    preparedMessages.push({
      id:
        message.id,

      role:
        message.role,

      originalContent:
        message.content,

      normalizedText,

      contentHash:
        createEmbeddingContentHash(
          normalizedText
        ),
    });
  }


  return preparedMessages;
}


/* =====================================================
   Read current embedding status
===================================================== */

async function loadExistingEmbeddingStatus(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    messageIds:
      string[];
  }
) {
  if (
    input.messageIds.length ===
    0
  ) {
    return new Map<
      string,
      ExistingMessageEmbeddingRow
    >();
  }


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
        "id",

        input.messageIds
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
      ExistingMessageEmbeddingRow[];


  return new Map(
    rows.map(
      (
        row
      ) => [
        row.id,

        row,
      ]
    )
  );
}


/* =====================================================
   Check whether embedding is current
===================================================== */

function isEmbeddingCurrent(
  input: {
    existing:
      ExistingMessageEmbeddingRow | undefined;

    expectedModel:
      string;

    expectedDimensions:
      number;

    contentHash:
      string;
  }
) {
  if (
    !input.existing
  ) {
    return false;
  }


  if (
    input
      .existing
      .embedding_model !==
    input.expectedModel
  ) {
    return false;
  }


  if (
    input
      .existing
      .embedding_dimensions !==
    input.expectedDimensions
  ) {
    return false;
  }


  if (
    input
      .existing
      .embedding_content_hash !==
    input.contentHash
  ) {
    return false;
  }


  if (
    !input
      .existing
      .embedded_at
  ) {
    return false;
  }


  return true;
}


/* =====================================================
   Save one embedding
===================================================== */

async function saveEmbedding(
  input: {
    supabase:
      SupabaseServerClient;

    conversationId:
      string;

    userId:
      string;

    messageId:
      string;

    embedding:
      number[];

    model:
      string;

    dimensions:
      number;

    contentHash:
      string;
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
          input.contentHash,

        embedded_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",

        input.messageId
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
   Main function
===================================================== */

export async function embedNewMessages(
  options:
    EmbedNewMessagesOptions
):
  Promise<
    AutomaticMessageEmbeddingResult
  > {
  const configuration =
    getEmbeddingConfiguration();


  const expectedModel =
    getExpectedEmbeddingModel();


  const uniqueMessages =
    removeDuplicateMessages(
      options.messages
    )
      .slice(
        0,

        MAX_MESSAGES_PER_REQUEST
      );


  const preparedMessages =
    prepareMessages(
      uniqueMessages
    );


  if (
    preparedMessages.length ===
    0
  ) {
    return {
      source:
        "none",

      model:
        expectedModel,

      dimensions:
        configuration
          .dimensions,

      receivedCount:
        uniqueMessages.length,

      eligibleCount:
        0,

      processedCount:
        0,

      skippedCount:
        uniqueMessages.length,

      failedCount:
        0,

      processedMessageIds:
        [],

      skippedMessageIds:
        uniqueMessages.map(
          (
            message
          ) =>
            message.id
        ),

      failedMessages:
        [],
    };
  }


  const existingStatus =
    await loadExistingEmbeddingStatus({
      supabase:
        options.supabase,

      conversationId:
        options.conversationId,

      userId:
        options.userId,

      messageIds:
        preparedMessages.map(
          (
            message
          ) =>
            message.id
        ),
    });


  const pendingMessages:
    PreparedMessage[] =
    [];


  const skippedMessageIds:
    string[] =
    [];


  for (
    const message of
      preparedMessages
  ) {
    const current =
      isEmbeddingCurrent({
        existing:
          existingStatus.get(
            message.id
          ),

        expectedModel,

        expectedDimensions:
          configuration
            .dimensions,

        contentHash:
          message
            .contentHash,
      });


    if (
      current
    ) {
      skippedMessageIds.push(
        message.id
      );
    } else {
      pendingMessages.push(
        message
      );
    }
  }


  if (
    pendingMessages.length ===
    0
  ) {
    return {
      source:
        "none",

      model:
        expectedModel,

      dimensions:
        configuration
          .dimensions,

      receivedCount:
        uniqueMessages.length,

      eligibleCount:
        preparedMessages.length,

      processedCount:
        0,

      skippedCount:
        skippedMessageIds.length,

      failedCount:
        0,

      processedMessageIds:
        [],

      skippedMessageIds,

      failedMessages:
        [],
    };
  }


  /**
   * پیام کاربر و پاسخ دستیار
   * در یک درخواست گروهی
   * به Embedding تبدیل می‌شوند.
   */
  const embeddingResults =
    await createEmbeddings(
      pendingMessages.map(
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
    pendingMessages.length
  ) {
    throw new Error(
      "Embedding result count does not match the number of pending messages."
    );
  }


  const processedMessageIds:
    string[] =
    [];


  const failedMessages:
    AutomaticMessageEmbeddingResult[
      "failedMessages"
    ] =
    [];


  await Promise.all(
    pendingMessages.map(
      async (
        message,

        index
      ) => {
        const result =
          embeddingResults[
            index
          ];


        try {
          await saveEmbedding({
            supabase:
              options.supabase,

            conversationId:
              options.conversationId,

            userId:
              options.userId,

            messageId:
              message.id,

            embedding:
              result.embedding,

            model:
              result.model,

            dimensions:
              result.dimensions,

            contentHash:
              result.contentHash,
          });


          processedMessageIds.push(
            message.id
          );
        } catch (
          error
        ) {
          failedMessages.push({
            id:
              message.id,

            error:
              error instanceof
              Error
                ? error.message
                : "Unknown embedding save error",
          });
        }
      }
    )
  );


  return {
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

    receivedCount:
      uniqueMessages.length,

    eligibleCount:
      preparedMessages.length,

    processedCount:
      processedMessageIds.length,

    skippedCount:
      skippedMessageIds.length,

    failedCount:
      failedMessages.length,

    processedMessageIds,

    skippedMessageIds,

    failedMessages,
  };
}