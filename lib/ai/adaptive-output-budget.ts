// lib/ai/adaptive-output-budget.ts
//
// Server-side adaptive max_tokens planner.
// Language-agnostic scoring with Persian keyword awareness.
// Does not change prompts or UI copy.

import type {
  ModelUsageTier,
} from "@/lib/assistant/demoModelPolicy";

import {
  getMaxOutputTokensForTier,
} from "@/lib/assistant/demoModelPolicy";


export type AdaptiveTaskClass =
  | "simple_question"
  | "normal_answer"
  | "analysis"
  | "comparison"
  | "official_letter"
  | "report"
  | "table_generation"
  | "strategic_document"
  | "document_analysis"
  | "rag_query";


export type AdaptiveComplexity =
  | "low"
  | "medium"
  | "high"
  | "very_high";


export type AdaptiveOutputBudgetInput = {
  userMessage:
    string;

  displayMessage?:
    string;

  assistantMode?:
    string | null;

  fileCount?:
    number;

  hasDocumentText?:
    boolean;

  hasImages?:
    boolean;

  /**
   * When true, retrieval/memory context was injected (soft RAG signal).
   */
  hasRagContext?:
    boolean;

  usageTier?:
    ModelUsageTier;
};


export type AdaptiveOutputBudgetResult = {
  taskClass:
    AdaptiveTaskClass;

  estimatedTokens:
    number;

  reasons:
    string[];

  fileCount:
    number;

  hasTable:
    boolean;

  hasDocument:
    boolean;

  complexity:
    AdaptiveComplexity;

  /**
   * Ideal range before tier clamping.
   */
  categoryMin:
    number;

  categoryMax:
    number;

  /**
   * Hard ceiling from model usage tier / DEMO_* env.
   */
  tierCap:
    number;
};


type CategoryBudget = {
  min:
    number;

  max:
    number;

  complexity:
    AdaptiveComplexity;
};


const CATEGORY_BUDGETS:
  Record<
    AdaptiveTaskClass,
    CategoryBudget
  > = {
    simple_question: {
      min: 800,
      max: 2500,
      complexity: "low",
    },

    normal_answer: {
      min: 1500,
      max: 6000,
      complexity: "medium",
    },

    analysis: {
      min: 3000,
      max: 12000,
      complexity: "high",
    },

    comparison: {
      min: 3000,
      max: 12000,
      complexity: "high",
    },

    official_letter: {
      min: 2500,
      max: 8000,
      complexity: "high",
    },

    report: {
      min: 4000,
      max: 16000,
      complexity: "high",
    },

    table_generation: {
      min: 4000,
      max: 16000,
      complexity: "very_high",
    },

    strategic_document: {
      min: 5000,
      max: 24000,
      complexity: "very_high",
    },

    document_analysis: {
      min: 4000,
      max: 16000,
      complexity: "high",
    },

    rag_query: {
      min: 4000,
      max: 20000,
      complexity: "high",
    },
  };


const PERSIAN_CHAR_RE =
  /[\u0600-\u06FF]/;


function normalizeText(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function includesAny(
  haystack:
    string,

  needles:
    string[]
) {
  return needles.some(
    (
      needle
    ) =>
      haystack.includes(
        needle
      )
  );
}


function estimateInputTokens(
  text:
    string
) {
  if (
    !text
  ) {
    return 0;
  }

  // Persian / mixed text: ~2 chars per token heuristic.
  return Math.max(
    1,

    Math.ceil(
      text.length /
        2
    )
  );
}


function detectSignals(
  text:
    string
) {
  const lower =
    text.toLowerCase();

  return {
    hasTable:
      includesAny(
        text,
        [
          "جدول",
          "table",
          "markdown table",
          "| ---",
        ]
      ) ||
      /\|.+\|/.test(
        text
      ),

    hasReport:
      includesAny(
        text,
        [
          "گزارش",
          "report",
        ]
      ),

    hasLetter:
      includesAny(
        text,
        [
          "نامه",
          "مکاتبه",
          "official letter",
          "correspondence",
        ]
      ),

    hasDocument:
      includesAny(
        text,
        [
          "سند",
          "document",
          "فایل",
          "پیوست",
          "file",
          "pdf",
          "docx",
        ]
      ),

    hasPlan:
      includesAny(
        text,
        [
          "برنامه",
          "برنامه‌ریزی",
          "roadmap",
          "plan",
        ]
      ),

    hasAnalysis:
      includesAny(
        text,
        [
          "تحلیل",
          "آنالیز",
          "analysis",
          "evaluate",
        ]
      ),

    hasComparison:
      includesAny(
        text,
        [
          "مقایسه",
          "تفاوت",
          "compare",
          "versus",
          "vs",
        ]
      ) ||
      lower.includes(
        " vs "
      ),

    hasDesign:
      includesAny(
        text,
        [
          "طراحی",
          "design",
          "architect",
        ]
      ),

    hasStrategy:
      includesAny(
        text,
        [
          "راهبرد",
          "استراتژی",
          "strategic",
          "strategy",
        ]
      ),

    hasSummary:
      includesAny(
        text,
        [
          "خلاصه",
          "summary",
          "summarize",
        ]
      ),

    isShortQuestion:
      text.length > 0 &&
      text.length <=
        80 &&
      (
        text.endsWith(
          "؟"
        ) ||
        text.endsWith(
          "?"
        ) ||
        includesAny(
          text,
          [
            "چیست",
            "کی است",
            "آیا",
            "what is",
            "who is",
          ]
        )
      ),
  };
}


function mapAssistantMode(
  mode:
    string | null | undefined
):
  AdaptiveTaskClass | null {
  switch (
    mode
  ) {
    case "official_letter":
      return "official_letter";

    case "analysis":
      return "document_analysis";

    case "research":
      return "analysis";

    case "planning":
      return "strategic_document";

    case "curriculum":
      return "report";

    case "content":
      return "normal_answer";

    default:
      return null;
  }
}


function pickTaskClass(
  input: {
    signals:
      ReturnType<
        typeof detectSignals
      >;

    assistantMode?:
      string | null;

    hasDocumentText:
      boolean;

    hasRagContext:
      boolean;

    fileCount:
      number;
  }
): {
  taskClass:
    AdaptiveTaskClass;

  reasons:
    string[];
} {
  const reasons:
    string[] =
    [];

  const modeClass =
    mapAssistantMode(
      input.assistantMode
    );

  if (
    modeClass
  ) {
    reasons.push(
      `assistant_mode:${input.assistantMode}`
    );
  }

  if (
    input.signals.hasTable
  ) {
    reasons.push(
      "keyword:table"
    );

    return {
      taskClass:
        "table_generation",

      reasons,
    };
  }

  if (
    input.signals.hasStrategy ||
    (
      input.signals.hasPlan &&
      input.signals.hasDesign
    )
  ) {
    reasons.push(
      "keyword:strategy_or_plan_design"
    );

    return {
      taskClass:
        "strategic_document",

      reasons,
    };
  }

  if (
    input.signals.hasLetter ||
    modeClass ===
      "official_letter"
  ) {
    reasons.push(
      "keyword_or_mode:official_letter"
    );

    return {
      taskClass:
        "official_letter",

      reasons,
    };
  }

  if (
    input.signals.hasReport
  ) {
    reasons.push(
      "keyword:report"
    );

    return {
      taskClass:
        "report",

      reasons,
    };
  }

  if (
    input.hasDocumentText ||
    (
      input.fileCount >
        0 &&
      input.signals.hasDocument
    ) ||
    modeClass ===
      "document_analysis"
  ) {
    reasons.push(
      "document_context"
    );

    return {
      taskClass:
        "document_analysis",

      reasons,
    };
  }

  if (
    input.signals.hasComparison
  ) {
    reasons.push(
      "keyword:comparison"
    );

    return {
      taskClass:
        "comparison",

      reasons,
    };
  }

  if (
    input.signals.hasAnalysis ||
    modeClass ===
      "analysis"
  ) {
    reasons.push(
      "keyword_or_mode:analysis"
    );

    return {
      taskClass:
        "analysis",

      reasons,
    };
  }

  if (
    input.hasRagContext
  ) {
    reasons.push(
      "rag_context_present"
    );

    return {
      taskClass:
        "rag_query",

      reasons,
    };
  }

  if (
    input.signals.isShortQuestion
  ) {
    reasons.push(
      "short_question"
    );

    return {
      taskClass:
        "simple_question",

      reasons,
    };
  }

  if (
    modeClass
  ) {
    return {
      taskClass:
        modeClass,

      reasons,
    };
  }

  reasons.push(
    "default:normal_answer"
  );

  return {
    taskClass:
      "normal_answer",

    reasons,
  };
}


function scoreWithinCategory(
  input: {
    taskClass:
      AdaptiveTaskClass;

    text:
      string;

    isPersian:
      boolean;

    fileCount:
      number;

    hasDocumentText:
      boolean;

    hasImages:
      boolean;

    hasRagContext:
      boolean;

    signals:
      ReturnType<
        typeof detectSignals
      >;
  }
) {
  const budget =
    CATEGORY_BUDGETS[
      input.taskClass
    ];

  let tokens =
    budget.min;

  const inputTokens =
    estimateInputTokens(
      input.text
    );

  // Longer asks usually need longer answers.
  tokens +=
    Math.min(
      1200,

      Math.floor(
        inputTokens *
          0.35
      )
    );

  if (
    input.isPersian
  ) {
    // Persian prose tends to use more tokens for the same idea.
    tokens = Math.floor(
      tokens *
        1.12
    );
  }

  if (
    input.fileCount >
    0
  ) {
    tokens +=
      Math.min(
        800,

        input.fileCount *
          250
      );
  }

  if (
    input.hasDocumentText
  ) {
    tokens +=
      600;
  }

  if (
    input.hasImages
  ) {
    tokens +=
      300;
  }

  if (
    input.hasRagContext
  ) {
    tokens +=
      1200;
  }

  if (
    input.signals.hasSummary &&
    input.taskClass !==
      "simple_question"
  ) {
    // Summaries can still be long for reports/docs.
    tokens = Math.floor(
      tokens *
        0.9
    );
  }

  return Math.max(
    budget.min,

    Math.min(
      budget.max,

      tokens
    )
  );
}


/**
 * Analyze the user request and return a dynamic output token budget.
 * Result is clamped to the model usage-tier ceiling (DEMO_* / free restrictions).
 */
export function resolveAdaptiveOutputBudget(
  input:
    AdaptiveOutputBudgetInput
):
  AdaptiveOutputBudgetResult {
  const userMessage =
    normalizeText(
      input.userMessage
    );

  const displayMessage =
    normalizeText(
      input.displayMessage
    );

  const text =
    [
      userMessage,

      displayMessage,
    ]
      .filter(
        Boolean
      )
      .join(
        "\n"
      );

  const fileCount =
    Math.max(
      0,

      input.fileCount ||
        0
    );

  const hasDocumentText =
    Boolean(
      input.hasDocumentText
    );

  const hasImages =
    Boolean(
      input.hasImages
    );

  const hasRagContext =
    Boolean(
      input.hasRagContext
    );

  const signals =
    detectSignals(
      text
    );

  const isPersian =
    PERSIAN_CHAR_RE.test(
      text
    );

  const {
    taskClass,

    reasons,
  } =
    pickTaskClass({
      signals,

      assistantMode:
        input.assistantMode,

      hasDocumentText,

      hasRagContext,

      fileCount,
    });

  if (
    isPersian
  ) {
    reasons.push(
      "language:persian"
    );
  }

  if (
    fileCount >
    0
  ) {
    reasons.push(
      `files:${fileCount}`
    );
  }

  const category =
    CATEGORY_BUDGETS[
      taskClass
    ];

  const idealTokens =
    scoreWithinCategory({
      taskClass,

      text,

      isPersian,

      fileCount,

      hasDocumentText,

      hasImages,

      hasRagContext,

      signals,
    });

  const usageTier =
    input.usageTier ||
    "manual";

  const tierCap =
    getMaxOutputTokensForTier(
      usageTier
    );

  // For long-form / RAG / document work, prefer the category ceiling so
  // answers are not truncated mid-citation when the ideal score is mid-range.
  const prefersFullCategory =
    taskClass === "rag_query" ||
    taskClass === "document_analysis" ||
    taskClass === "report" ||
    taskClass === "strategic_document" ||
    taskClass === "table_generation" ||
    hasRagContext ||
    hasDocumentText;

  const uncappedTokens =
    prefersFullCategory
      ? Math.max(
        idealTokens,
        category.max
      )
      : idealTokens;

  const estimatedTokens =
    Math.max(
      256,

      Math.min(
        uncappedTokens,

        tierCap
      )
    );

  if (
    estimatedTokens <
    uncappedTokens
  ) {
    reasons.push(
      `clamped_by_tier_cap:${tierCap}`
    );
  }

  if (
    prefersFullCategory
  ) {
    reasons.push(
      "prefer_full_category_budget"
    );
  }

  const result:
    AdaptiveOutputBudgetResult = {
      taskClass,

      estimatedTokens,

      reasons,

      fileCount,

      hasTable:
        signals.hasTable,

      hasDocument:
        hasDocumentText ||
        signals.hasDocument ||
        fileCount >
          0,

      complexity:
        category.complexity,

      categoryMin:
        category.min,

      categoryMax:
        category.max,

      tierCap,
    };

  console.log(
    "[adaptive-output-budget]",

    {
      taskClass:
        result.taskClass,

      estimatedTokens:
        result.estimatedTokens,

      reasons:
        result.reasons,

      fileCount:
        result.fileCount,

      hasTable:
        result.hasTable,

      hasDocument:
        result.hasDocument,

      complexity:
        result.complexity,

      categoryMin:
        result.categoryMin,

      categoryMax:
        result.categoryMax,

      tierCap:
        result.tierCap,

      usageTier,
    }
  );

  return result;
}
