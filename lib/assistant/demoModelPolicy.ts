// lib/assistant/demoModelPolicy.ts

/**
 * سیاست مرکزی انتخاب مدل در نسخه دمو و نسخه‌های آینده
 *
 * هدف:
 * - جلوگیری از مصرف ناخواسته Credit در حالت رایگان
 * - تعریف مدل اصلی دمو برای مدیران
 * - آماده‌سازی برای مدل‌های آینده: رایگان، اصلی، پیشرفته، معاونتی و دستی
 * - تبدیل aliasهای داخلی به مدل واقعی OpenRouter
 */

export type ModelUsageTier =
  | "free"
  | "main"
  | "advanced"
  | "manual";

export type ResolvedModelPolicy = {
  /**
   * مدلی که از گفتگو، UI یا دیتابیس آمده است.
   */
  requestedModel: string;

  /**
   * مدلی که واقعاً باید به OpenRouter ارسال شود.
   */
  resolvedModel: string;

  /**
   * سطح مصرف مدل برای کنترل توکن و اعتبار.
   */
  usageTier: ModelUsageTier;

  /**
   * سقف خروجی مجاز برای این مدل.
   */
  maxOutputTokens: number;

  /**
   * آیا مدل رایگان است؟
   */
  isFree: boolean;

  /**
   * آیا در حالت دمو هستیم؟
   */
  demoMode: boolean;

  /**
   * آیا اجازه fallback پولی وجود دارد؟
   * فعلاً برای مدل رایگان در دمو false است.
   */
  allowPaidFallback: boolean;
};


/**
 * Aliasهای داخلی سامانه.
 *
 * این‌ها را می‌توان بعداً در UI ذخیره کرد،
 * بدون اینکه مستقیم وابسته به مدل واقعی OpenRouter باشیم.
 */
export const DEMO_FREE_MODEL_ALIAS =
  "demo/free";

export const DEMO_MAIN_MODEL_ALIAS =
  "demo/main";

export const DEMO_ADVANCED_MODEL_ALIAS =
  "demo/advanced";

export const OPENROUTER_AUTO_MODEL =
  "openrouter/auto";

export const OPENROUTER_FREE_MODEL =
  "openrouter/free";


export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}


export function getDemoFreeModel(): string {
  return (
    process.env.DEMO_FREE_MODEL?.trim() ||
    OPENROUTER_FREE_MODEL
  );
}


export function getDemoMainModel(): string {
  return (
    process.env.DEMO_MAIN_MODEL?.trim() ||
    "openai/gpt-4o-mini"
  );
}


export function getDemoAdvancedModel(): string {
  return (
    process.env.DEMO_ADVANCED_MODEL?.trim() ||
    getDemoMainModel()
  );
}


export function isFreeModelId(
  model: string
): boolean {
  const cleanModel =
    model.trim().toLowerCase();

  return (
    cleanModel === OPENROUTER_FREE_MODEL ||
    cleanModel === DEMO_FREE_MODEL_ALIAS ||
    cleanModel.endsWith(":free")
  );
}


function readPositiveIntegerEnv(
  key: string,
  fallback: number
): number {
  const rawValue =
    process.env[key]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.floor(parsedValue);
}


export function getDefaultModelForCurrentMode(): string {
  if (isDemoMode()) {
    return getDemoFreeModel();
  }

  return (
    process.env.OPENROUTER_DEFAULT_MODEL?.trim() ||
    OPENROUTER_AUTO_MODEL
  );
}


/**
 * تبدیل مدل انتخاب‌شده به مدل واقعی OpenRouter
 *
 * نکته مهم:
 * در حالت دمو، openrouter/auto را به openrouter/free تبدیل می‌کنیم؛
 * چون openrouter/auto ممکن است مدل پولی انتخاب کند.
 */
export function resolveModelForOpenRouter(
  model?: string | null
): string {
  const cleanModel =
    model?.trim();

  if (!cleanModel) {
    return getDefaultModelForCurrentMode();
  }

  if (
    isDemoMode() &&
    cleanModel === OPENROUTER_AUTO_MODEL
  ) {
    return getDemoFreeModel();
  }

  if (
    cleanModel === DEMO_FREE_MODEL_ALIAS
  ) {
    return getDemoFreeModel();
  }

  if (
    cleanModel === DEMO_MAIN_MODEL_ALIAS
  ) {
    return getDemoMainModel();
  }

  if (
    cleanModel === DEMO_ADVANCED_MODEL_ALIAS
  ) {
    return getDemoAdvancedModel();
  }

  return cleanModel;
}


export function getModelUsageTier(
  model: string
): ModelUsageTier {
  const resolvedModel =
    resolveModelForOpenRouter(model);

  if (isFreeModelId(resolvedModel)) {
    return "free";
  }

  if (
    resolvedModel === getDemoMainModel()
  ) {
    return "main";
  }

  if (
    resolvedModel === getDemoAdvancedModel()
  ) {
    return "advanced";
  }

  return "manual";
}


export function getMaxOutputTokensForTier(
  tier: ModelUsageTier
): number {
  // Optional global override — set high to avoid mid-answer truncation.
  const globalCap =
    readPositiveIntegerEnv(
      "CHAT_MAX_OUTPUT_TOKENS",
      0
    );

  if (globalCap > 0) {
    return globalCap;
  }

  switch (tier) {
    case "free":
      return readPositiveIntegerEnv(
        "DEMO_MAX_OUTPUT_TOKENS_FREE",
        8000
      );

    case "main":
      return readPositiveIntegerEnv(
        "DEMO_MAX_OUTPUT_TOKENS_MAIN",
        16000
      );

    case "advanced":
      return readPositiveIntegerEnv(
        "DEMO_MAX_OUTPUT_TOKENS_ADVANCED",
        32768
      );

    case "manual":

    default:
      return readPositiveIntegerEnv(
        "DEMO_MAX_OUTPUT_TOKENS_ADVANCED",
        32768
      );
  }
}


export function resolveModelPolicy(
  model?: string | null
): ResolvedModelPolicy {
  const requestedModel =
    model?.trim() ||
    getDefaultModelForCurrentMode();

  const resolvedModel =
    resolveModelForOpenRouter(
      requestedModel
    );

  const usageTier =
    getModelUsageTier(
      resolvedModel
    );

  const isFree =
    isFreeModelId(
      resolvedModel
    );

  const demoMode =
    isDemoMode();

  const disablePaidFallbackForFree =
    process.env
      .DEMO_DISABLE_PAID_FALLBACK_FOR_FREE ===
    "true";

  return {
    requestedModel,
    resolvedModel,
    usageTier,
    isFree,
    demoMode,

    maxOutputTokens:
      getMaxOutputTokensForTier(
        usageTier
      ),

    allowPaidFallback:
      !(
        demoMode &&
        isFree &&
        disablePaidFallbackForFree
      ),
  };
}