// types/chat.ts


/* =====================================================
   Chat Messages
===================================================== */

export type Message = {
  role:
    | "user"
    | "assistant"
    | "system";

  content:
    | string
    | any[];
};


export type ChatMessage = {
  role:
    | "user"
    | "assistant";

  content:
    string;
};


/* =====================================================
   Assistant Modes
===================================================== */

export type AssistantModeId =
  | "general"
  | "official_letter"
  | "curriculum"
  | "research"
  | "content"
  | "planning"
  | "analysis";


export type AssistantMode = {
  id:
    AssistantModeId;

  title:
    string;

  shortTitle:
    string;

  description:
    string;

  icon:
    string;

  placeholder:
    string;
};


/* =====================================================
   Quick Actions
===================================================== */

export type QuickAction = {
  id:
    string;

  title:
    string;

  description:
    string;

  prompt:
    string;

  modeId:
    AssistantModeId;

  icon:
    string;
};


/* =====================================================
   OpenRouter Model Selection
===================================================== */

/**
 * نحوه انتخاب مدل برای هر گفتگو
 *
 * auto:
 * انتخاب خودکار مدل توسط OpenRouter
 *
 * preset:
 * استفاده از گزینه‌های آماده
 * مانند مدل رایگان خودکار
 *
 * advanced:
 * انتخاب مستقیم یک مدل مشخص
 */
export type ModelSelectionMode =
  | "auto"
  | "preset"
  | "advanced";


/**
 * قابلیت‌های هر مدل
 */
export type ModelCapabilities = {
  /**
   * پشتیبانی از ورودی متنی
   */
  text?:
    boolean;


  /**
   * پشتیبانی از ورودی تصویر
   */
  imageInput?:
    boolean;


  /**
   * پشتیبانی از ورودی صوتی
   */
  audioInput?:
    boolean;


  /**
   * پشتیبانی از ابزارها
   * و Function Calling
   */
  tools?:
    boolean;


  /**
   * دارای قابلیت استدلال
   */
  reasoning?:
    boolean;


  /**
   * پشتیبانی از خروجی ساختاریافته
   */
  structuredOutput?:
    boolean;
};


/**
 * اطلاعات هر مدل دریافت‌شده
 * از OpenRouter
 */
export type OpenRouterModel = {
  /**
   * شناسه اصلی مدل
   *
   * مثال:
   * openrouter/auto
   *
   * anthropic/claude-sonnet-...
   */
  id:
    string;


  /**
   * نام نمایشی مدل
   */
  name:
    string;


  /**
   * شرکت یا ارائه‌دهنده مدل
   */
  provider:
    string;


  /**
   * توضیح مدل
   */
  description:
    string;


  /**
   * ظرفیت Context مدل
   */
  contextLength:
    | number
    | null;


  /**
   * حداکثر تعداد توکن خروجی
   */
  maxCompletionTokens:
    | number
    | null;


  /**
   * هزینه تقریبی یک میلیون
   * توکن ورودی
   */
  promptPricePerMillion:
    | number
    | null;


  /**
   * هزینه تقریبی یک میلیون
   * توکن خروجی
   */
  completionPricePerMillion:
    | number
    | null;


  /**
   * آیا مدل رایگان است؟
   */
  isFree:
    boolean;


  /**
   * آیا گزینه یک Router است؟
   *
   * مانند:
   * openrouter/auto
   */
  isRouter:
    boolean;


  /**
   * نوع انتخاب مدل
   */
  selectionMode:
    ModelSelectionMode;


  /**
   * قابلیت‌های مدل
   */
  capabilities?:
    ModelCapabilities;
};


/**
 * اطلاعات مدل ذخیره‌شده
 * برای یک گفتگوی مشخص
 */
export type ConversationModelSelection = {
  /**
   * شناسه گفتگو
   */
  conversationId:
    string;


  /**
   * عنوان گفتگو
   */
  title:
    string;


  /**
   * شناسه مدل انتخاب‌شده
   */
  selectedModel:
    string;


  /**
   * نحوه انتخاب مدل
   */
  modelSelectionMode:
    ModelSelectionMode;


  /**
   * تنظیمات اختصاصی مدل
   */
  modelPreferences:
    Record<
      string,
      unknown
    >;


  /**
   * زمان آخرین تغییر مدل
   */
  modelUpdatedAt:
    | string
    | null;
};