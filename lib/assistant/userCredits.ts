// lib/assistant/userCredits.ts

import type {
  Message,
} from "@/types/chat";

import type {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  DEMO_FREE_MODEL_ALIAS,
  DEMO_MAIN_MODEL_ALIAS,
  OPENROUTER_AUTO_MODEL,
  OPENROUTER_FREE_MODEL,
  resolveModelPolicy,
} from "@/lib/assistant/demoModelPolicy";


type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;


export type UserPlan =
  | "trial"
  | "free"
  | "pro"
  | "admin";


export type AllowedModelTier =
  | "free"
  | "main"
  | "advanced"
  | "all";


export type AccessModePreference =
  | "auto"
  | "subscription"
  | "free";


export type EffectiveAccess =
  | "trial"
  | "subscription"
  | "free";


export type UserAiCreditsRecord = {
  user_id:
    string;

  plan:
    UserPlan;

  trial_token_limit:
    number;

  trial_tokens_used:
    number;

  subscription_active:
    boolean;

  allowed_model_tier:
    AllowedModelTier;

  warning_shown:
    boolean;

  last_auto_downgrade_at:
    string | null;

  subscription_started_at:
    string | null;

  subscription_expires_at:
    string | null;

  monthly_token_limit:
    number;

  monthly_tokens_used:
    number;

  monthly_period_started_at:
    string | null;

  payment_provider:
    string | null;

  payment_reference_id:
    string | null;

  subscription_note:
    string | null;

  access_mode_preference:
    AccessModePreference;

  last_access_mode_change_at:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


export type UserModelDecision = {
  credits:
    UserAiCreditsRecord;

  requestedModel:
    string;

  effectiveModel:
    string;

  effectiveAccess:
    EffectiveAccess;

  hasTrialAccess:
    boolean;

  hasSubscriptionAccess:
    boolean;

  hasActiveSubscriptionEntitlement:
    boolean;

  isUsingFreeMode:
    boolean;

  remainingTrialTokens:
    number;

  remainingMonthlyTokens:
    number | null;

  shouldCountTrialUsage:
    boolean;

  shouldCountMonthlyUsage:
    boolean;

  shouldShowUpgradeWarning:
    boolean;

  warningText:
    string;
};


/* =====================================================
   Constants
===================================================== */

const DEFAULT_TRIAL_TOKEN_LIMIT =
  100000;


const DEFAULT_MONTHLY_TOKEN_LIMIT =
  500000;


const CREDIT_WARNING_TEXT =
  "⚠️ اعتبار رایگان استفاده از مدل اصلی شما به پایان رسیده است. این پاسخ با مدل رایگان ارائه می‌شود. برای استفاده دوباره از مدل‌های قوی‌تر، اشتراک خود را فعال کنید.";


const MONTHLY_LIMIT_WARNING_TEXT =
  "⚠️ سقف مصرف ماهانه اشتراک شما به پایان رسیده است. این پاسخ با مدل رایگان ارائه می‌شود. برای ادامه استفاده از مدل‌های قوی‌تر، باید اعتبار یا اشتراک خود را تمدید کنید.";


/* =====================================================
   Helpers
===================================================== */

function readPositiveIntegerEnv(
  key:
    string,

  fallback:
    number
) {
  const rawValue =
    process.env[key]?.trim();


  if (
    !rawValue
  ) {
    return fallback;
  }


  const parsedValue =
    Number(
      rawValue
    );


  if (
    !Number.isFinite(
      parsedValue
    ) ||

    parsedValue <=
      0
  ) {
    return fallback;
  }


  return Math.floor(
    parsedValue
  );
}


function getInitialTrialTokenLimit() {
  return readPositiveIntegerEnv(
    "DEMO_TRIAL_TOKEN_LIMIT",
    DEFAULT_TRIAL_TOKEN_LIMIT
  );
}


function getDefaultMonthlyTokenLimit() {
  return readPositiveIntegerEnv(
    "PRO_MONTHLY_TOKEN_LIMIT",
    DEFAULT_MONTHLY_TOKEN_LIMIT
  );
}


function normalizePlan(
  value:
    unknown
):
  UserPlan {
  if (
    value === "trial" ||
    value === "free" ||
    value === "pro" ||
    value === "admin"
  ) {
    return value;
  }


  return "trial";
}


function normalizeAllowedModelTier(
  value:
    unknown
):
  AllowedModelTier {
  if (
    value === "free" ||
    value === "main" ||
    value === "advanced" ||
    value === "all"
  ) {
    return value;
  }


  return "main";
}


function normalizeAccessModePreference(
  value:
    unknown
):
  AccessModePreference {
  if (
    value === "auto" ||
    value === "subscription" ||
    value === "free"
  ) {
    return value;
  }


  return "auto";
}


function normalizeNumber(
  value:
    unknown,

  fallback:
    number
) {
  const parsedValue =
    Number(
      value
    );


  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }


  return Math.max(
    0,

    Math.floor(
      parsedValue
    )
  );
}


function normalizeDateString(
  value:
    unknown
) {
  if (
    typeof value ===
    "string" &&
    value.trim()
  ) {
    return value;
  }


  return null;
}


function isFutureDate(
  value:
    string | null
) {
  if (
    !value
  ) {
    return true;
  }


  const time =
    new Date(
      value
    ).getTime();


  if (
    Number.isNaN(
      time
    )
  ) {
    return false;
  }


  return time >
    Date.now();
}


function normalizeCreditRecord(
  value:
    unknown
):
  UserAiCreditsRecord {
  const record =
    value as
    Partial<
      UserAiCreditsRecord
    >;


  return {
    user_id:
      String(
        record.user_id ||
        ""
      ),

    plan:
      normalizePlan(
        record.plan
      ),

    trial_token_limit:
      normalizeNumber(
        record.trial_token_limit,

        DEFAULT_TRIAL_TOKEN_LIMIT
      ),

    trial_tokens_used:
      normalizeNumber(
        record.trial_tokens_used,

        0
      ),

    subscription_active:
      Boolean(
        record.subscription_active
      ),

    allowed_model_tier:
      normalizeAllowedModelTier(
        record.allowed_model_tier
      ),

    warning_shown:
      Boolean(
        record.warning_shown
      ),

    last_auto_downgrade_at:
      normalizeDateString(
        record.last_auto_downgrade_at
      ),

    subscription_started_at:
      normalizeDateString(
        record.subscription_started_at
      ),

    subscription_expires_at:
      normalizeDateString(
        record.subscription_expires_at
      ),

    monthly_token_limit:
      normalizeNumber(
        record.monthly_token_limit,

        0
      ),

    monthly_tokens_used:
      normalizeNumber(
        record.monthly_tokens_used,

        0
      ),

    monthly_period_started_at:
      normalizeDateString(
        record.monthly_period_started_at
      ),

    payment_provider:
      typeof record.payment_provider ===
        "string"
        ? record.payment_provider
        : null,

    payment_reference_id:
      typeof record.payment_reference_id ===
        "string"
        ? record.payment_reference_id
        : null,

    subscription_note:
      typeof record.subscription_note ===
        "string"
        ? record.subscription_note
        : null,

    access_mode_preference:
      normalizeAccessModePreference(
        record.access_mode_preference
      ),

    last_access_mode_change_at:
      normalizeDateString(
        record.last_access_mode_change_at
      ),

    created_at:
      String(
        record.created_at ||
        new Date()
          .toISOString()
      ),

    updated_at:
      String(
        record.updated_at ||
        new Date()
          .toISOString()
      ),
  };
}


/* =====================================================
   Token estimate
===================================================== */

export function estimateTextTokens(
  text:
    string
) {
  const cleanText =
    text || "";


  return Math.max(
    1,

    Math.ceil(
      cleanText.length /
      4
    )
  );
}


function getMessageTextForTokenEstimate(
  message:
    Message
) {
  if (
    typeof message.content ===
    "string"
  ) {
    return message.content;
  }


  if (
    Array.isArray(
      message.content
    )
  ) {
    return message
      .content
      .map(
        (
          part
        ) => {
          if (
            part &&
            typeof part ===
              "object" &&
            "text" in part &&
            typeof part.text ===
              "string"
          ) {
            return part.text;
          }

          return "";
        }
      )
      .filter(
        Boolean
      )
      .join(
        "\n"
      );
  }


  return "";
}


export function estimateMessagesTokens(
  messages:
    Message[]
) {
  return messages.reduce(
    (
      total,

      message
    ) =>
      total +
      estimateTextTokens(
        getMessageTextForTokenEstimate(
          message
        )
      ),

    0
  );
}


/* =====================================================
   Credit calculations
===================================================== */

export function getRemainingTrialTokens(
  credits:
    UserAiCreditsRecord
) {
  return Math.max(
    0,

    credits.trial_token_limit -
    credits.trial_tokens_used
  );
}


export function getRemainingMonthlyTokens(
  credits:
    UserAiCreditsRecord
) {
  if (
    credits.monthly_token_limit <=
    0
  ) {
    return null;
  }


  return Math.max(
    0,

    credits.monthly_token_limit -
    credits.monthly_tokens_used
  );
}


export function hasActiveSubscriptionEntitlement(
  credits:
    UserAiCreditsRecord
) {
  if (
    credits.plan ===
    "admin"
  ) {
    return true;
  }


  if (
    credits.plan !==
      "pro" &&

    !credits.subscription_active
  ) {
    return false;
  }


  if (
    !credits.subscription_active
  ) {
    return false;
  }


  return isFutureDate(
    credits.subscription_expires_at
  );
}


export function hasMonthlyQuota(
  credits:
    UserAiCreditsRecord
) {
  if (
    credits.plan ===
    "admin"
  ) {
    return true;
  }


  if (
    !hasActiveSubscriptionEntitlement(
      credits
    )
  ) {
    return false;
  }


  const remainingMonthlyTokens =
    getRemainingMonthlyTokens(
      credits
    );


  /**
   * اگر monthly_token_limit برابر ۰ باشد،
   * یعنی برای آن کاربر سقف ماهانه تعریف نشده
   * و فعلاً نامحدود در نظر گرفته می‌شود.
   */
  if (
    remainingMonthlyTokens ===
    null
  ) {
    return true;
  }


  return remainingMonthlyTokens >
    0;
}


export function isUserPreferringFreeMode(
  credits:
    UserAiCreditsRecord
) {
  return credits.access_mode_preference ===
    "free";
}


export function hasSubscriptionAccess(
  credits:
    UserAiCreditsRecord
) {
  return (
    hasActiveSubscriptionEntitlement(
      credits
    ) &&

    hasMonthlyQuota(
      credits
    ) &&

    !isUserPreferringFreeMode(
      credits
    )
  );
}


export function hasTrialAccess(
  credits:
    UserAiCreditsRecord
) {
  return (
    !hasSubscriptionAccess(
      credits
    ) &&

    !isUserPreferringFreeMode(
      credits
    ) &&

    getRemainingTrialTokens(
      credits
    ) >
      0
  );
}


export function getEffectiveAccess(
  credits:
    UserAiCreditsRecord
):
  EffectiveAccess {
  if (
    hasSubscriptionAccess(
      credits
    )
  ) {
    return "subscription";
  }


  if (
    hasTrialAccess(
      credits
    )
  ) {
    return "trial";
  }


  return "free";
}


/* =====================================================
   Database
===================================================== */

export async function ensureUserAiCredits(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;
  }
):
  Promise<
    UserAiCreditsRecord
  > {
  const {
    supabase,

    userId,
  } =
    input;


  const {
    data:
      existingCreditData,

    error:
      existingCreditError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .select(
        "*"
      )
      .eq(
        "user_id",

        userId
      )
      .maybeSingle();


  if (
    existingCreditError
  ) {
    throw new Error(
      existingCreditError.message
    );
  }


  if (
    existingCreditData
  ) {
    return normalizeCreditRecord(
      existingCreditData
    );
  }


  const {
    data:
      insertedCreditData,

    error:
      insertCreditError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .insert({
        user_id:
          userId,

        plan:
          "trial",

        trial_token_limit:
          getInitialTrialTokenLimit(),

        trial_tokens_used:
          0,

        subscription_active:
          false,

        allowed_model_tier:
          "main",

        warning_shown:
          false,

        monthly_token_limit:
          0,

        monthly_tokens_used:
          0,

        access_mode_preference:
          "auto",
      })
      .select(
        "*"
      )
      .single();


  if (
    insertCreditError ||
    !insertedCreditData
  ) {
    throw new Error(
      insertCreditError
        ?.message ||
      "Could not create user AI credits."
    );
  }


  return normalizeCreditRecord(
    insertedCreditData
  );
}


/* =====================================================
   Model access decision
===================================================== */

function normalizeRequestedModel(
  requestedModel:
    string | null | undefined
) {
  const cleanModel =
    requestedModel?.trim();


  if (
    !cleanModel
  ) {
    return DEMO_MAIN_MODEL_ALIAS;
  }


  return cleanModel;
}


function isAutoOrFreeModel(
  model:
    string
) {
  return (
    model === OPENROUTER_AUTO_MODEL ||

    model === OPENROUTER_FREE_MODEL ||

    model === DEMO_FREE_MODEL_ALIAS
  );
}


function getSubscriptionEffectiveModel(
  requestedModel:
    string
) {
  const requestedPolicy =
    resolveModelPolicy(
      requestedModel
    );


  /**
   * اگر کاربر در حالت Pro باشد ولی selected_model قدیمی
   * هنوز openrouter/free یا openrouter/auto باشد،
   * مدل مؤثر را به demo/main می‌بریم.
   */
  if (
    isAutoOrFreeModel(
      requestedModel
    ) ||

    requestedPolicy.usageTier ===
      "free"
  ) {
    return DEMO_MAIN_MODEL_ALIAS;
  }


  return requestedModel;
}


function getTrialEffectiveModel(
  requestedModel:
    string
) {
  const requestedPolicy =
    resolveModelPolicy(
      requestedModel
    );


  if (
    isAutoOrFreeModel(
      requestedModel
    ) ||

    requestedPolicy.usageTier ===
      "manual" ||

    requestedPolicy.usageTier ===
      "advanced"
  ) {
    return DEMO_MAIN_MODEL_ALIAS;
  }


  return requestedModel;
}


export function resolveModelForUserCredits(
  input: {
    requestedModel:
      string | null | undefined;

    credits:
      UserAiCreditsRecord;
  }
):
  UserModelDecision {
  const requestedModel =
    normalizeRequestedModel(
      input.requestedModel
    );


  const credits =
    input.credits;


  const activeSubscriptionEntitlement =
    hasActiveSubscriptionEntitlement(
      credits
    );


  const subscriptionAccess =
    hasSubscriptionAccess(
      credits
    );


  const trialAccess =
    hasTrialAccess(
      credits
    );


  const remainingTrialTokens =
    getRemainingTrialTokens(
      credits
    );


  const remainingMonthlyTokens =
    getRemainingMonthlyTokens(
      credits
    );


  const effectiveAccess =
    getEffectiveAccess(
      credits
    );


  if (
    effectiveAccess ===
    "subscription"
  ) {
    return {
      credits,

      requestedModel,

      effectiveModel:
        getSubscriptionEffectiveModel(
          requestedModel
        ),

      effectiveAccess,

      hasTrialAccess:
        false,

      hasSubscriptionAccess:
        true,

      hasActiveSubscriptionEntitlement:
        activeSubscriptionEntitlement,

      isUsingFreeMode:
        false,

      remainingTrialTokens,

      remainingMonthlyTokens,

      shouldCountTrialUsage:
        false,

      shouldCountMonthlyUsage:
        true,

      shouldShowUpgradeWarning:
        false,

      warningText:
        "",
    };
  }


  if (
    effectiveAccess ===
    "trial"
  ) {
    return {
      credits,

      requestedModel,

      effectiveModel:
        getTrialEffectiveModel(
          requestedModel
        ),

      effectiveAccess,

      hasTrialAccess:
        trialAccess,

      hasSubscriptionAccess:
        false,

      hasActiveSubscriptionEntitlement:
        activeSubscriptionEntitlement,

      isUsingFreeMode:
        false,

      remainingTrialTokens,

      remainingMonthlyTokens,

      shouldCountTrialUsage:
        true,

      shouldCountMonthlyUsage:
        false,

      shouldShowUpgradeWarning:
        false,

      warningText:
        "",
    };
  }


  const warningText =
    activeSubscriptionEntitlement &&
    !hasMonthlyQuota(
      credits
    ) &&
    !isUserPreferringFreeMode(
      credits
    )
      ? MONTHLY_LIMIT_WARNING_TEXT
      : CREDIT_WARNING_TEXT;


  return {
    credits,

    requestedModel,

    effectiveModel:
      DEMO_FREE_MODEL_ALIAS,

    effectiveAccess:
      "free",

    hasTrialAccess:
      false,

    hasSubscriptionAccess:
      false,

    hasActiveSubscriptionEntitlement:
      activeSubscriptionEntitlement,

    isUsingFreeMode:
      true,

    remainingTrialTokens:
      0,

    remainingMonthlyTokens,

    shouldCountTrialUsage:
      false,

    shouldCountMonthlyUsage:
      false,

    shouldShowUpgradeWarning:
      !isUserPreferringFreeMode(
        credits
      ),

    warningText,
  };
}


/* =====================================================
   Usage update
===================================================== */

export async function addTrialTokenUsage(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    credits:
      UserAiCreditsRecord;

    tokensToAdd:
      number;
  }
) {
  const {
    supabase,

    userId,

    credits,
  } =
    input;


  const tokensToAdd =
    Math.max(
      0,

      Math.floor(
        input.tokensToAdd
      )
    );


  if (
    tokensToAdd <=
    0
  ) {
    return credits;
  }


  if (
    !input.credits ||
    !hasTrialAccess(
      credits
    )
  ) {
    return credits;
  }


  const nextUsed =
    credits.trial_tokens_used +
    tokensToAdd;


  const {
    data:
      updatedCreditData,

    error:
      updateCreditError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .update({
        trial_tokens_used:
          nextUsed,
      })
      .eq(
        "user_id",

        userId
      )
      .select(
        "*"
      )
      .single();


  if (
    updateCreditError ||
    !updatedCreditData
  ) {
    console.error(
      "Update user AI trial credits error:",

      updateCreditError
    );


    return credits;
  }


  return normalizeCreditRecord(
    updatedCreditData
  );
}


export async function addMonthlyTokenUsage(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    credits:
      UserAiCreditsRecord;

    tokensToAdd:
      number;
  }
) {
  const {
    supabase,

    userId,

    credits,
  } =
    input;


  const tokensToAdd =
    Math.max(
      0,

      Math.floor(
        input.tokensToAdd
      )
    );


  if (
    tokensToAdd <=
    0
  ) {
    return credits;
  }


  if (
    !hasSubscriptionAccess(
      credits
    )
  ) {
    return credits;
  }


  if (
    credits.monthly_token_limit <=
    0
  ) {
    return credits;
  }


  const nextUsed =
    credits.monthly_tokens_used +
    tokensToAdd;


  const {
    data:
      updatedCreditData,

    error:
      updateCreditError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .update({
        monthly_tokens_used:
          nextUsed,
      })
      .eq(
        "user_id",

        userId
      )
      .select(
        "*"
      )
      .single();


  if (
    updateCreditError ||
    !updatedCreditData
  ) {
    console.error(
      "Update user AI monthly credits error:",

      updateCreditError
    );


    return credits;
  }


  return normalizeCreditRecord(
    updatedCreditData
  );
}


export async function addTokenUsageByDecision(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    decision:
      UserModelDecision;

    tokensToAdd:
      number;
  }
) {
  if (
    input.decision.shouldCountMonthlyUsage
  ) {
    return addMonthlyTokenUsage({
      supabase:
        input.supabase,

      userId:
        input.userId,

      credits:
        input.decision.credits,

      tokensToAdd:
        input.tokensToAdd,
    });
  }


  if (
    input.decision.shouldCountTrialUsage
  ) {
    return addTrialTokenUsage({
      supabase:
        input.supabase,

      userId:
        input.userId,

      credits:
        input.decision.credits,

      tokensToAdd:
        input.tokensToAdd,
    });
  }


  return input.decision.credits;
}


/* =====================================================
   Preference and subscription actions
===================================================== */

export async function updateAccessModePreference(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    accessModePreference:
      AccessModePreference;
  }
) {
  const {
    supabase,

    userId,

    accessModePreference,
  } =
    input;


  const {
    data:
      updatedCreditData,

    error:
      updateError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .update({
        access_mode_preference:
          accessModePreference,

        last_access_mode_change_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "user_id",

        userId
      )
      .select(
        "*"
      )
      .single();


  if (
    updateError ||
    !updatedCreditData
  ) {
    throw new Error(
      updateError
        ?.message ||
      "Could not update access mode preference."
    );
  }


  return normalizeCreditRecord(
    updatedCreditData
  );
}


export async function activateInternalProSubscription(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;

    paymentReferenceId?:
      string | null;

    paymentProvider?:
      string | null;

    note?:
      string | null;

    monthlyTokenLimit?:
      number;

    days?:
      number;
  }
) {
  const {
    supabase,

    userId,
  } =
    input;


  const days =
    input.days &&

    input.days > 0
      ? Math.floor(
          input.days
        )
      : 30;


  const monthlyTokenLimit =
    input.monthlyTokenLimit &&

    input.monthlyTokenLimit > 0
      ? Math.floor(
          input.monthlyTokenLimit
        )
      : getDefaultMonthlyTokenLimit();


  const now =
    new Date();


  const expiresAt =
    new Date(
      now.getTime() +
      days *
        24 *
        60 *
        60 *
        1000
    );


  const {
    data:
      updatedCreditData,

    error:
      updateError,
  } =
    await supabase
      .from(
        "user_ai_credits"
      )
      .update({
        plan:
          "pro",

        subscription_active:
          true,

        allowed_model_tier:
          "advanced",

        subscription_started_at:
          now.toISOString(),

        subscription_expires_at:
          expiresAt.toISOString(),

        monthly_token_limit:
          monthlyTokenLimit,

        monthly_tokens_used:
          0,

        monthly_period_started_at:
          now.toISOString(),

        payment_provider:
          input.paymentProvider ||
          "internal",

        payment_reference_id:
          input.paymentReferenceId ||
          null,

        subscription_note:
          input.note ||
          "Internal subscription activated",

        access_mode_preference:
          "subscription",

        last_access_mode_change_at:
          now.toISOString(),
      })
      .eq(
        "user_id",

        userId
      )
      .select(
        "*"
      )
      .single();


  if (
    updateError ||
    !updatedCreditData
  ) {
    throw new Error(
      updateError
        ?.message ||
      "Could not activate internal Pro subscription."
    );
  }


  return normalizeCreditRecord(
    updatedCreditData
  );
}


export async function markUpgradeWarningShown(
  input: {
    supabase:
      SupabaseServerClient;

    userId:
      string;
  }
) {
  const {
    supabase,

    userId,
  } =
    input;


  await supabase
    .from(
      "user_ai_credits"
    )
    .update({
      warning_shown:
        true,

      last_auto_downgrade_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "user_id",

      userId
    );
}