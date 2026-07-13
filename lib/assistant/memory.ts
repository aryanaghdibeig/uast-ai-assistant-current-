// lib/assistant/memory.ts

import type { AssistantModeId } from "@/types/chat";

export type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type ConversationBehaviorProfile = {
  preferredTone?: string;
  detailLevel?: string;
  preferredFormats?: string[];
  workingStyle?: string;
  workingPreferences?: string[];
  domainFocus?: string[];
};

export type ConversationMemoryResult = {
  summary: string;
  behaviorProfile: ConversationBehaviorProfile;
};

type BuildMemoryPromptInput = {
  conversationTitle: string;
  assistantMode: AssistantModeId;
  previousSummary: string;
  previousBehaviorProfile: ConversationBehaviorProfile;
  newMessages: MemoryMessage[];
  totalMessageCount: number;
};

function cleanText(
  value: unknown,
  maxLength = 5000
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanArray(
  value: unknown,
  maxItems = 8,
  maxItemLength = 120
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (const item of value) {
    const cleanItem = cleanText(
      item,
      maxItemLength
    );

    if (
      cleanItem &&
      !result.includes(cleanItem)
    ) {
      result.push(cleanItem);
    }

    if (
      result.length >= maxItems
    ) {
      break;
    }
  }

  return result;
}

export function getAssistantModeLabel(
  modeId: AssistantModeId
) {
  switch (modeId) {
    case "official_letter":
      return "مکاتبات اداری";

    case "curriculum":
      return "برنامه‌درسی و مهارتی";

    case "research":
      return "پژوهش و فناوری";

    case "content":
      return "تولید محتوا";

    case "planning":
      return "برنامه‌ریزی و مدیریت";

    case "analysis":
      return "تحلیل اسناد";

    case "general":

    default:
      return "عمومی";
  }
}

export function normalizeBehaviorProfile(
  value: unknown
): ConversationBehaviorProfile {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const profile = value as Record<
    string,
    unknown
  >;

  const result:
    ConversationBehaviorProfile = {};

  const preferredTone =
    cleanText(
      profile.preferredTone,
      100
    );

  const detailLevel =
    cleanText(
      profile.detailLevel,
      100
    );

  const workingStyle =
    cleanText(
      profile.workingStyle,
      160
    );

  const preferredFormats =
    cleanArray(
      profile.preferredFormats
    );

  const workingPreferences =
    cleanArray(
      profile.workingPreferences
    );

  const domainFocus =
    cleanArray(
      profile.domainFocus
    );

  if (preferredTone) {
    result.preferredTone =
      preferredTone;
  }

  if (detailLevel) {
    result.detailLevel =
      detailLevel;
  }

  if (workingStyle) {
    result.workingStyle =
      workingStyle;
  }

  if (
    preferredFormats.length >
    0
  ) {
    result.preferredFormats =
      preferredFormats;
  }

  if (
    workingPreferences.length >
    0
  ) {
    result.workingPreferences =
      workingPreferences;
  }

  if (
    domainFocus.length >
    0
  ) {
    result.domainFocus =
      domainFocus;
  }

  return result;
}

export function buildMemoryTranscript(
  messages: MemoryMessage[]
) {
  return messages
    .map(
      (
        message,
        index
      ) => {
        const roleLabel =
          message.role === "user"
            ? "کاربر"
            : "دستیار";

        const content =
          cleanText(
            message.content,
            5000
          );

        return `${index + 1}. ${roleLabel}: ${content}`;
      }
    )
    .join("\n\n");
}

export function buildMemoryPrompt({
  conversationTitle,
  assistantMode,
  previousSummary,
  previousBehaviorProfile,
  newMessages,
  totalMessageCount,
}: BuildMemoryPromptInput) {
  const modeLabel =
    getAssistantModeLabel(
      assistantMode
    );

  const transcript =
    buildMemoryTranscript(
      newMessages
    );

  return `
شما موتور حافظه یک دستیار هوشمند دانشگاهی هستید.

وظیفه شما:
۱. خلاصه قبلی گفتگو را با پیام‌های جدید ادغام کنید.
۲. یک خلاصه به‌روز، دقیق و فشرده از گفتگو تولید کنید.
۳. ترجیحات رفتاری و شیوه تعامل کاربر را فقط بر اساس شواهد روشن گفتگو استخراج کنید.
۴. از حدس‌زدن ویژگی‌های شخصی، هویتی، پزشکی، سیاسی، مذهبی یا سایر اطلاعات حساس خودداری کنید.

اطلاعات گفتگو:

عنوان گفتگو:
${cleanText(
  conversationTitle,
  300
)}

حالت کاری:
${modeLabel}

تعداد کل پیام‌ها:
${totalMessageCount}

خلاصه قبلی:
${
  cleanText(
    previousSummary,
    5000
  ) ||
  "هنوز خلاصه‌ای وجود ندارد."
}

پروفایل رفتاری قبلی:
${JSON.stringify(
  normalizeBehaviorProfile(
    previousBehaviorProfile
  ),
  null,
  2
)}

پیام‌های جدید:
${
  transcript ||
  "پیام جدیدی وجود ندارد."
}

قواعد خلاصه:

- موضوع اصلی گفتگو را حفظ کنید.
- اهداف، تصمیم‌ها، درخواست‌های مهم و خروجی‌های تولیدشده را ثبت کنید.
- نکات حل‌نشده و اقدامات بعدی را در صورت وجود حفظ کنید.
- از تکرار جزئیات غیرضروری خودداری کنید.
- خلاصه باید برای ادامه گفتگو در آینده مفید باشد.
- خلاصه را به زبان فارسی بنویسید.
- خلاصه حداکثر حدود ۷۰۰ کلمه باشد.

قواعد پروفایل رفتاری:

- فقط ترجیحات مرتبط با نحوه پاسخ‌گویی را ثبت کنید.
- فقط ترجیحاتی را ثبت کنید که از گفتگو قابل استنباط روشن هستند.
- ویژگی شخصیتی یا اطلاعات حساس را حدس نزنید.
- preferredTone نمونه: «رسمی و مدیریتی»
- detailLevel نمونه: «کامل و مرحله‌به‌مرحله»
- preferredFormats نمونه: ["جدول", "گزارش تحلیلی"]
- workingStyle نمونه: «اجرای گام‌به‌گام همراه با تست»
- workingPreferences نمونه: ["ارائه کد کامل", "پرهیز از کد تکه‌تکه"]
- domainFocus نمونه: ["برنامه‌ریزی", "آموزش عالی"]

خروجی فقط یک JSON معتبر باشد.

فرمت دقیق:

{
  "summary": "خلاصه به‌روز گفتگو",
  "behaviorProfile": {
    "preferredTone": "ترجیح لحن",
    "detailLevel": "میزان جزئیات",
    "preferredFormats": [
      "قالب ترجیحی"
    ],
    "workingStyle": "سبک کار ترجیحی",
    "workingPreferences": [
      "ترجیح کاری"
    ],
    "domainFocus": [
      "حوزه موضوعی"
    ]
  }
}

هیچ متن، توضیح، Markdown یا کد دیگری خارج از JSON تولید نکن.
`.trim();
}

export function extractJsonObject(
  value: string
) {
  const cleaned = value
    .replace(
      /```json/gi,
      ""
    )
    .replace(
      /```/g,
      ""
    )
    .trim();

  const startIndex =
    cleaned.indexOf("{");

  const endIndex =
    cleaned.lastIndexOf("}");

  if (
    startIndex === -1 ||
    endIndex === -1 ||
    endIndex <= startIndex
  ) {
    throw new Error(
      "No valid JSON object was found."
    );
  }

  return JSON.parse(
    cleaned.slice(
      startIndex,
      endIndex + 1
    )
  );
}

export function parseMemoryResult(
  value: unknown
): ConversationMemoryResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Memory response is not an object."
    );
  }

  const raw = value as Record<
    string,
    unknown
  >;

  const summary =
    cleanText(
      raw.summary,
      12000
    );

  if (!summary) {
    throw new Error(
      "Memory summary is empty."
    );
  }

  return {
    summary,

    behaviorProfile:
      normalizeBehaviorProfile(
        raw.behaviorProfile
      ),
  };
}

function inferMockBehaviorProfile(
  messages: MemoryMessage[],
  previousProfile:
    ConversationBehaviorProfile
) {
  const combinedText =
    messages
      .map(
        (
          message
        ) =>
          message.content
      )
      .join(" ");

  const nextProfile:
    ConversationBehaviorProfile = {
    ...normalizeBehaviorProfile(
      previousProfile
    ),
  };

  const preferences =
    new Set(
      nextProfile
        .workingPreferences ||
      []
    );

  const formats =
    new Set(
      nextProfile
        .preferredFormats ||
      []
    );

  if (
    combinedText.includes(
      "کد کامل"
    )
  ) {
    preferences.add(
      "ارائه کد کامل"
    );
  }

  if (
    combinedText.includes(
      "تکه تکه"
    ) ||
    combinedText.includes(
      "تکه‌تکه"
    )
  ) {
    preferences.add(
      "پرهیز از ارائه کد تکه‌تکه"
    );
  }

  if (
    combinedText.includes(
      "قدم به قدم"
    ) ||
    combinedText.includes(
      "گام به گام"
    ) ||
    combinedText.includes(
      "مرحله به مرحله"
    )
  ) {
    nextProfile.workingStyle =
      "اجرای مرحله‌به‌مرحله همراه با کنترل نتیجه";
  }

  if (
    combinedText.includes(
      "رسمی"
    ) ||
    combinedText.includes(
      "اداری"
    )
  ) {
    nextProfile.preferredTone =
      "رسمی و حرفه‌ای";
  }

  if (
    combinedText.includes(
      "جدول"
    )
  ) {
    formats.add(
      "جدول"
    );
  }

  if (
    combinedText.includes(
      "گزارش"
    )
  ) {
    formats.add(
      "گزارش تحلیلی"
    );
  }

  if (
    combinedText.includes(
      "کامل"
    ) ||
    combinedText.includes(
      "مفصل"
    )
  ) {
    nextProfile.detailLevel =
      "کامل و دارای جزئیات";
  }

  nextProfile
    .workingPreferences =
    Array.from(
      preferences
    );

  nextProfile
    .preferredFormats =
    Array.from(
      formats
    );

  return nextProfile;
}

export function createMockMemoryResult({
  conversationTitle,
  assistantMode,
  previousSummary,
  previousBehaviorProfile,
  newMessages,
  totalMessageCount,
}: BuildMemoryPromptInput): ConversationMemoryResult {
  const modeLabel =
    getAssistantModeLabel(
      assistantMode
    );

  const recentMessages =
    newMessages.slice(-10);

  const recentSummary =
    recentMessages
      .map(
        (
          message
        ) => {
          const roleLabel =
            message.role ===
            "user"
              ? "کاربر"
              : "دستیار";

          const content =
            cleanText(
              message.content,
              350
            );

          return `- ${roleLabel}: ${content}`;
        }
      )
      .join("\n");

  const summaryParts: string[] =
    [];

  if (
    previousSummary.trim()
  ) {
    summaryParts.push(
      previousSummary.trim()
    );
  }

  summaryParts.push(
    `عنوان گفتگو: ${conversationTitle}`
  );

  summaryParts.push(
    `حالت کاری: ${modeLabel}`
  );

  summaryParts.push(
    `تعداد پیام‌های ثبت‌شده: ${totalMessageCount}`
  );

  if (
    recentSummary
  ) {
    summaryParts.push(
      `نکات جدید گفتگو:\n${recentSummary}`
    );
  }

  return {
    summary:
      summaryParts.join(
        "\n\n"
      ),

    behaviorProfile:
      inferMockBehaviorProfile(
        newMessages,
        previousBehaviorProfile
      ),
  };
}

export function buildMemoryContextForPrompt(
  summary: string,
  profile:
    ConversationBehaviorProfile
) {
  const cleanSummary =
    cleanText(
      summary,
      8000
    );

  const cleanProfile =
    normalizeBehaviorProfile(
      profile
    );

  if (
    !cleanSummary &&
    Object.keys(
      cleanProfile
    ).length === 0
  ) {
    return "";
  }

  return `
حافظه این گفتگو:

خلاصه گفتگو:
${
  cleanSummary ||
  "خلاصه‌ای ثبت نشده است."
}

ترجیحات رفتاری مرتبط با نحوه پاسخ‌گویی:
${JSON.stringify(
  cleanProfile,
  null,
  2
)}

از این حافظه فقط برای حفظ پیوستگی موضوع، تصمیم‌ها و ترجیحات نحوه پاسخ‌گویی استفاده کنید.
در صورت تعارض میان حافظه و آخرین درخواست کاربر، آخرین درخواست کاربر اولویت دارد.
`.trim();
}