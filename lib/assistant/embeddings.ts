// lib/assistant/embeddings.ts

import {
  createHash,
} from "node:crypto";


/* =====================================================
   Types
===================================================== */

export type EmbeddingInputType =
  | "search_query"
  | "search_document";


export type EmbeddingSource =
  | "mock"
  | "openrouter";


export type EmbeddingResult = {
  embedding:
    number[];

  model:
    string;

  dimensions:
    number;

  contentHash:
    string;

  source:
    EmbeddingSource;

  inputType:
    EmbeddingInputType;

  normalizedText:
    string;

  usage?: {
    promptTokens:
      number;

    totalTokens:
      number;
  };
};


type CreateEmbeddingOptions = {
  inputType?:
    EmbeddingInputType;
};


type OpenRouterEmbeddingItem = {
  embedding:
    number[];

  index:
    number;

  object?:
    string;
};


type OpenRouterEmbeddingResponse = {
  id?:
    string;

  object?:
    string;

  model?:
    string;

  data?:
    OpenRouterEmbeddingItem[];

  usage?: {
    prompt_tokens?:
      number;

    total_tokens?:
      number;
  };

  error?: {
    code?:
      string | number;

    message?:
      string;
  };
};


/* =====================================================
   Constants
===================================================== */

const DEFAULT_EMBEDDING_MODEL =
  "openai/text-embedding-3-small";


const REQUIRED_EMBEDDING_DIMENSIONS =
  1536;


/**
 * برای جلوگیری از ارسال متن بسیار بزرگ
 * به سرویس Embedding.
 *
 * پیام اصلی همچنان بدون تغییر
 * در Supabase باقی می‌ماند.
 */
const MAX_EMBEDDING_TEXT_LENGTH =
  12000;


/* =====================================================
   Configuration
===================================================== */

export function getEmbeddingModel() {
  return (
    process.env
      .EMBEDDING_MODEL
      ?.trim() ||

    DEFAULT_EMBEDDING_MODEL
  );
}


export function getEmbeddingDimensions() {
  const rawValue =
    Number(
      process.env
        .EMBEDDING_DIMENSIONS ||

      REQUIRED_EMBEDDING_DIMENSIONS
    );


  if (
    !Number.isInteger(
      rawValue
    ) ||

    rawValue <=
      0
  ) {
    throw new Error(
      "EMBEDDING_DIMENSIONS must be a positive integer."
    );
  }


  /**
   * ستون فعلی Supabase:
   *
   * extensions.vector(1536)
   *
   * بنابراین خروجی مدل نیز باید
   * دقیقاً ۱۵۳۶بعدی باشد.
   */
  if (
    rawValue !==
    REQUIRED_EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Embedding dimensions mismatch. Database expects ${REQUIRED_EMBEDDING_DIMENSIONS}, but environment contains ${rawValue}.`
    );
  }


  return rawValue;
}


export function isMockEmbeddingEnabled() {
  const explicitValue =
    process.env
      .MOCK_EMBEDDINGS;


  /**
   * اگر MOCK_EMBEDDINGS مشخص شده باشد،
   * همان مقدار اولویت دارد.
   */
  if (
    typeof explicitValue ===
    "string"
  ) {
    return (
      explicitValue
        .trim()
        .toLowerCase() ===
      "true"
    );
  }


  /**
   * برای سازگاری با پروژه فعلی،
   * اگر متغیر مستقل تعریف نشده باشد،
   * از MOCK_AI پیروی می‌کنیم.
   */
  return (
    process.env
      .MOCK_AI ===
    "true"
  );
}


export function getEmbeddingConfiguration() {
  return {
    model:
      getEmbeddingModel(),

    dimensions:
      getEmbeddingDimensions(),

    mockEnabled:
      isMockEmbeddingEnabled(),
  };
}


/* =====================================================
   Text normalization
===================================================== */

function normalizeDigits(
  value:
    string
) {
  const digitMap:
    Record<
      string,
      string
    > = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",

    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };


  return value.replace(
    /[۰-۹٠-٩]/g,

    (
      digit
    ) =>
      digitMap[
        digit
      ] ||
      digit
  );
}


export function normalizeEmbeddingText(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }


  return normalizeDigits(
    value
      .normalize(
        "NFKC"
      )
  )
    .replace(
      /\u0000/g,

      ""
    )
    .replace(
      /ي/g,

      "ی"
    )
    .replace(
      /ك/g,

      "ک"
    )
    .replace(
      /\s+/g,

      " "
    )
    .trim()
    .slice(
      0,

      MAX_EMBEDDING_TEXT_LENGTH
    );
}


/* =====================================================
   Content hash
===================================================== */

export function createEmbeddingContentHash(
  text:
    string
) {
  return createHash(
    "sha256"
  )
    .update(
      text,

      "utf8"
    )
    .digest(
      "hex"
    );
}


/* =====================================================
   Vector helpers
===================================================== */

function normalizeVector(
  vector:
    number[]
) {
  let squaredSum =
    0;


  for (
    const value of
      vector
  ) {
    squaredSum +=
      value *
      value;
  }


  const magnitude =
    Math.sqrt(
      squaredSum
    );


  if (
    magnitude ===
    0
  ) {
    return vector;
  }


  return vector.map(
    (
      value
    ) =>
      value /
      magnitude
  );
}


function validateEmbeddingVector(
  vector:
    unknown,

  expectedDimensions:
    number
):
  number[] {
  if (
    !Array.isArray(
      vector
    )
  ) {
    throw new Error(
      "Embedding response is not an array."
    );
  }


  if (
    vector.length !==
    expectedDimensions
  ) {
    throw new Error(
      `Invalid embedding dimensions. Expected ${expectedDimensions}, received ${vector.length}.`
    );
  }


  const safeVector =
    vector.map(
      (
        value
      ) => {
        const numericValue =
          Number(
            value
          );


        if (
          !Number.isFinite(
            numericValue
          )
        ) {
          throw new Error(
            "Embedding contains a non-finite value."
          );
        }


        return numericValue;
      }
    );


  return safeVector;
}


/* =====================================================
   Mock embedding
===================================================== */

/**
 * این Embedding آزمایشی:
 *
 * - رایگان است
 * - به OpenRouter متصل نمی‌شود
 * - همیشه برای یک متن، بردار یکسان می‌سازد
 * - برای تست ذخیره و بازیابی مناسب است
 *
 * اما جای مدل Embedding واقعی را نمی‌گیرد.
 */
function createMockEmbedding(
  text:
    string,

  dimensions:
    number
) {
  const vector =
    new Array<number>(
      dimensions
    ).fill(
      0
    );


  const tokens =
    text
      .toLowerCase()
      .split(
        /[^\p{L}\p{N}]+/u
      )
      .map(
        (
          token
        ) =>
          token.trim()
      )
      .filter(
        (
          token
        ) =>
          token.length >
          1
      );


  const addFeature =
    (
      feature:
        string,

      weight:
        number
    ) => {
      const digest =
        createHash(
          "sha256"
        )
          .update(
            feature,

            "utf8"
          )
          .digest();


      const firstIndex =
        digest.readUInt32BE(
          0
        ) %
        dimensions;


      const secondIndex =
        digest.readUInt32BE(
          4
        ) %
        dimensions;


      const firstSign =
        digest[
          8
        ] %
          2 ===
        0
          ? 1
          : -1;


      const secondSign =
        digest[
          9
        ] %
          2 ===
        0
          ? 1
          : -1;


      vector[
        firstIndex
      ] +=
        firstSign *
        weight;


      vector[
        secondIndex
      ] +=
        secondSign *
        weight *
        0.5;
    };


  /**
   * ویژگی‌های تک‌واژه‌ای
   */
  for (
    const token of
      tokens
  ) {
    addFeature(
      `token:${token}`,

      1
    );
  }


  /**
   * ترکیب دو واژه متوالی
   */
  for (
    let index =
      0;

    index <
    tokens.length -
      1;

    index++
  ) {
    addFeature(
      `bigram:${tokens[index]}_${tokens[index + 1]}`,

      0.7
    );
  }


  /**
   * در متن‌های بسیار کوتاه
   * حداقل یک ویژگی ایجاد می‌شود.
   */
  if (
    tokens.length ===
    0
  ) {
    addFeature(
      `text:${text}`,

      1
    );
  }


  return normalizeVector(
    vector
  );
}


/* =====================================================
   OpenRouter request
===================================================== */

async function requestOpenRouterEmbeddings(
  texts:
    string[],

  inputType:
    EmbeddingInputType
) {
  const apiKey =
    process.env
      .OPENROUTER_API_KEY
      ?.trim();


  if (
    !apiKey
  ) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }


  const model =
    getEmbeddingModel();


  const dimensions =
    getEmbeddingDimensions();


  const response =
    await fetch(
      "https://openrouter.ai/api/v1/embeddings",

      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            model,

            input:
              texts,

            dimensions,

            encoding_format:
              "float",

            input_type:
              inputType,
          }),

        cache:
          "no-store",
      }
    );


  const responseData =
    await response
      .json()
      .catch(
        () => ({})
      ) as
      OpenRouterEmbeddingResponse;


  if (
    !response.ok
  ) {
    const errorMessage =
      responseData
        .error
        ?.message ||

      `OpenRouter embedding request failed with status ${response.status}.`;


    throw new Error(
      errorMessage
    );
  }


  if (
    !Array.isArray(
      responseData.data
    )
  ) {
    throw new Error(
      "OpenRouter embedding response does not contain data."
    );
  }


  if (
    responseData
      .data
      .length !==
    texts.length
  ) {
    throw new Error(
      `OpenRouter returned ${responseData.data.length} embeddings for ${texts.length} inputs.`
    );
  }


  const orderedItems =
    [
      ...responseData
        .data,
    ].sort(
      (
        first,

        second
      ) =>
        first.index -
        second.index
    );


  return {
    model:
      responseData
        .model ||
      model,

    dimensions,

    vectors:
      orderedItems.map(
        (
          item
        ) =>
          validateEmbeddingVector(
            item.embedding,

            dimensions
          )
      ),

    usage: {
      promptTokens:
        Number(
          responseData
            .usage
            ?.prompt_tokens ||
          0
        ),

      totalTokens:
        Number(
          responseData
            .usage
            ?.total_tokens ||
          0
        ),
    },
  };
}


/* =====================================================
   Public embedding functions
===================================================== */

export async function createEmbeddings(
  inputs:
    string[],

  options:
    CreateEmbeddingOptions =
      {}
):
  Promise<
    EmbeddingResult[]
  > {
  if (
    !Array.isArray(
      inputs
    ) ||

    inputs.length ===
    0
  ) {
    throw new Error(
      "At least one embedding input is required."
    );
  }


  const inputType =
    options
      .inputType ||

    "search_document";


  const normalizedTexts =
    inputs.map(
      (
        input
      ) =>
        normalizeEmbeddingText(
          input
        )
    );


  if (
    normalizedTexts.some(
      (
        text
      ) =>
        !text
    )
  ) {
    throw new Error(
      "Embedding input cannot be empty."
    );
  }


  const dimensions =
    getEmbeddingDimensions();


  const contentHashes =
    normalizedTexts.map(
      (
        text
      ) =>
        createEmbeddingContentHash(
          text
        )
    );


  /**
   * حالت آزمایشی
   */
  if (
    isMockEmbeddingEnabled()
  ) {
    return normalizedTexts.map(
      (
        text,

        index
      ) => ({
        embedding:
          createMockEmbedding(
            text,

            dimensions
          ),

        model:
          "mock-hashed-embedding-v1",

        dimensions,

        contentHash:
          contentHashes[
            index
          ],

        source:
          "mock",

        inputType,

        normalizedText:
          text,

        usage: {
          promptTokens:
            0,

          totalTokens:
            0,
        },
      })
    );
  }


  /**
   * حالت واقعی OpenRouter
   */
  const openRouterResult =
    await requestOpenRouterEmbeddings(
      normalizedTexts,

      inputType
    );


  return normalizedTexts.map(
    (
      text,

      index
    ) => ({
      embedding:
        openRouterResult
          .vectors[
          index
        ],

      model:
        openRouterResult
          .model,

      dimensions:
        openRouterResult
          .dimensions,

      contentHash:
        contentHashes[
          index
        ],

      source:
        "openrouter",

      inputType,

      normalizedText:
        text,

      usage:
        openRouterResult
          .usage,
    })
  );
}


export async function createEmbedding(
  input:
    string,

  options:
    CreateEmbeddingOptions =
      {}
):
  Promise<
    EmbeddingResult
  > {
  const results =
    await createEmbeddings(
      [
        input,
      ],

      options
    );


  return results[
    0
  ];
}


/* =====================================================
   Similarity helper
===================================================== */

export function cosineSimilarity(
  firstVector:
    number[],

  secondVector:
    number[]
) {
  if (
    firstVector.length !==
    secondVector.length
  ) {
    throw new Error(
      "Vectors must have equal dimensions."
    );
  }


  let dotProduct =
    0;

  let firstMagnitude =
    0;

  let secondMagnitude =
    0;


  for (
    let index =
      0;

    index <
    firstVector.length;

    index++
  ) {
    const firstValue =
      firstVector[
        index
      ];


    const secondValue =
      secondVector[
        index
      ];


    dotProduct +=
      firstValue *
      secondValue;


    firstMagnitude +=
      firstValue *
      firstValue;


    secondMagnitude +=
      secondValue *
      secondValue;
  }


  const denominator =
    Math.sqrt(
      firstMagnitude
    ) *

    Math.sqrt(
      secondMagnitude
    );


  if (
    denominator ===
    0
  ) {
    return 0;
  }


  return (
    dotProduct /
    denominator
  );
}