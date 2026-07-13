// lib/assistant/followups.ts

import type { AssistantModeId } from "@/types/chat";

export type SmartFollowUpAction = {
  id: string;
  title: string;
  description: string;
  icon: string;

  // این دستور در پشت صحنه برای مدل ارسال می‌شود.
  // موضوع گفتگو به آن اضافه نمی‌شود؛
  // مدل باید موضوع را از سابقه همان گفتگو درک کند.
  prompt: string;
};

type SmartFollowUpInput = {
  modeId: AssistantModeId;
  topic?: string;
  conversationTitle?: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
};

function cleanText(value?: string) {
  if (!value) return "";

  return value
    .replace(/📎 \[File Uploaded\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenTopic(value: string, maxLength = 36) {
  const cleanValue = cleanText(value);

  if (!cleanValue) return "";

  return cleanValue.length > maxLength
    ? `${cleanValue.slice(0, maxLength)}...`
    : cleanValue;
}

function resolveTopic(input: SmartFollowUpInput) {
  const topicCandidates = [
    input.topic,
    input.conversationTitle,
    input.lastUserMessage,
  ];

  for (const item of topicCandidates) {
    const cleanItem = cleanText(item);

    if (
      cleanItem &&
      cleanItem !== "گفتگوی جدید" &&
      cleanItem !== "گفتگوی فایل" &&
      cleanItem !== "بدون پیام"
    ) {
      return shortenTopic(cleanItem);
    }
  }

  return "موضوع گفتگو";
}

function getCommonActions(topic: string): SmartFollowUpAction[] {
  return [
    {
      id: "summarize",
      title: "خلاصه‌تر کن",
      description: `خلاصه کاربردی درباره «${topic}»`,
      icon: "✨",
      prompt:
        "پاسخ قبلی را خلاصه‌تر، منظم‌تر و کاربردی‌تر ارائه کن. موضوع و زمینه همین گفتگو را حفظ کن.",
    },
    {
      id: "improve-structure",
      title: "ساختارمندتر کن",
      description: `بازآرایی پاسخ درباره «${topic}»`,
      icon: "🧱",
      prompt:
        "پاسخ قبلی را با حفظ موضوع همین گفتگو، ساختارمندتر کن؛ از تیترهای روشن، بخش‌بندی منظم و جمع‌بندی نهایی استفاده کن.",
    },
    {
      id: "make-table",
      title: "تبدیل به جدول کن",
      description: `جدول دقیق برای «${topic}»`,
      icon: "📋",
      prompt:
        "محتوای پاسخ قبلی را با حفظ موضوع و اطلاعات موجود، در قالب یک جدول دقیق، منظم و قابل استفاده بازطراحی کن.",
    },
    {
      id: "continue",
      title: "ادامه بده",
      description: `ادامه منطقی درباره «${topic}»`,
      icon: "➡️",
      prompt:
        "ادامه منطقی پاسخ قبلی را با همان موضوع، لحن و ساختار بنویس و نکات تکمیلی مهم را اضافه کن.",
    },
  ];
}

function getModeActions(
  modeId: AssistantModeId,
  topic: string
): SmartFollowUpAction[] {
  switch (modeId) {
    case "official_letter":
      return [
        {
          id: "more-official",
          title: "رسمی‌تر کن",
          description: `لحن اداری برای «${topic}»`,
          icon: "🏛️",
          prompt:
            "متن قبلی را با حفظ موضوع، منظور و درخواست اصلی، رسمی‌تر، اداری‌تر و مناسب مکاتبه سازمانی بازنویسی کن.",
        },
        {
          id: "send-ready",
          title: "نسخه قابل ارسال بساز",
          description: `نامه نهایی درباره «${topic}»`,
          icon: "📨",
          prompt:
            "از متن قبلی یک نسخه نهایی، منسجم، رسمی و آماده ارسال تهیه کن. اطلاعات و موضوع همان گفتگو را حفظ کن.",
        },
        {
          id: "short-letter",
          title: "کوتاه‌تر و قاطع‌تر کن",
          description: `نامه مختصر برای «${topic}»`,
          icon: "✂️",
          prompt:
            "متن قبلی را بدون تغییر موضوع و منظور اصلی، کوتاه‌تر، قاطع‌تر و همچنان رسمی و محترمانه بازنویسی کن.",
        },
        {
          id: "add-request",
          title: "درخواست اصلی را تقویت کن",
          description: `تقویت مطالبه درباره «${topic}»`,
          icon: "📌",
          prompt:
            "در متن قبلی، درخواست اصلی را شفاف‌تر، قوی‌تر و اداری‌تر بیان کن و انسجام کل نامه را حفظ کن.",
        },
      ];

    case "curriculum":
      return [
        {
          id: "learning-outcomes",
          title: "خروجی یادگیری بده",
          description: `نتایج یادگیری برای «${topic}»`,
          icon: "🎓",
          prompt:
            "براساس موضوع و محتوای قبلی، خروجی‌های یادگیری، شایستگی‌های مورد انتظار و معیارهای ارزشیابی را مشخص کن.",
        },
        {
          id: "course-table",
          title: "جدول دوره بساز",
          description: `سرفصل و جلسه برای «${topic}»`,
          icon: "🧩",
          prompt:
            "محتوای قبلی را به جدول طراحی دوره شامل جلسه، سرفصل، فعالیت عملی، منابع و روش ارزشیابی تبدیل کن.",
        },
        {
          id: "skill-based",
          title: "مهارت‌محورتر کن",
          description: `تمرکز بر بازار کار در «${topic}»`,
          icon: "🛠️",
          prompt:
            "پاسخ قبلی را با حفظ موضوع، مهارت‌محورتر کن و ارتباط آن را با بازار کار، شایستگی و فعالیت عملی تقویت کن.",
        },
        {
          id: "assessment",
          title: "روش ارزشیابی بده",
          description: `ارزیابی شایستگی در «${topic}»`,
          icon: "✅",
          prompt:
            "براساس محتوای قبلی، روش‌های ارزشیابی نظری، عملی، پروژه‌ای و شایستگی‌محور پیشنهاد بده.",
        },
      ];

    case "research":
      return [
        {
          id: "problem-statement",
          title: "بیان مسئله بنویس",
          description: `بیان مسئله برای «${topic}»`,
          icon: "🔍",
          prompt:
            "براساس موضوع و محتوای قبلی، یک بیان مسئله پژوهشی دقیق، رسمی، منسجم و قابل استفاده بنویس.",
        },
        {
          id: "research-objectives",
          title: "اهداف پژوهش بده",
          description: `اهداف پژوهش درباره «${topic}»`,
          icon: "🎯",
          prompt:
            "براساس موضوع قبلی، هدف کلی، اهداف اختصاصی و پرسش‌های پژوهش را تدوین کن.",
        },
        {
          id: "methodology",
          title: "روش تحقیق پیشنهاد کن",
          description: `روش مناسب برای «${topic}»`,
          icon: "🧪",
          prompt:
            "براساس موضوع قبلی، روش تحقیق مناسب، جامعه هدف، نمونه، ابزار گردآوری داده و مراحل اجرا را پیشنهاد کن.",
        },
        {
          id: "outputs",
          title: "خروجی‌های پژوهش را مشخص کن",
          description: `خروجی‌های علمی و اجرایی «${topic}»`,
          icon: "📦",
          prompt:
            "براساس موضوع و اهداف مطرح‌شده در گفتگو، خروجی‌های علمی، اجرایی، فناورانه و سیاستی پژوهش را مشخص کن.",
        },
      ];

    case "content":
      return [
        {
          id: "content-script",
          title: "سناریو بنویس",
          description: `سناریوی محتوا برای «${topic}»`,
          icon: "🎬",
          prompt:
            "براساس موضوع و محتوای قبلی، یک سناریوی آموزشی یا رسانه‌ای جذاب و قابل اجرا بنویس.",
        },
        {
          id: "slide-outline",
          title: "طرح اسلاید بده",
          description: `اسلایدهای پیشنهادی برای «${topic}»`,
          icon: "🖥️",
          prompt:
            "محتوای قبلی را به طرح اسلاید شامل عنوان هر اسلاید، پیام کلیدی و نکات اصلی تبدیل کن.",
        },
        {
          id: "make-engaging",
          title: "جذاب‌تر کن",
          description: `روایت جذاب‌تر برای «${topic}»`,
          icon: "🌟",
          prompt:
            "متن قبلی را با حفظ پیام و موضوع اصلی، جذاب‌تر، روان‌تر و مناسب ارائه یا انتشار عمومی بازنویسی کن.",
        },
        {
          id: "news-version",
          title: "نسخه خبری بساز",
          description: `خبر رسمی درباره «${topic}»`,
          icon: "📰",
          prompt:
            "براساس محتوای قبلی، یک خبر رسمی، حرفه‌ای و مناسب انتشار در وب‌سایت دانشگاه تهیه کن.",
        },
      ];

    case "planning":
      return [
        {
          id: "action-table",
          title: `جدول اقدام ${topic}`,
          description: "هدف، اقدام، مسئول و زمان‌بندی",
          icon: "📊",
          prompt:
            "براساس موضوع و پاسخ قبلی، یک جدول برنامه عملیاتی شامل هدف، اقدام، مسئول، زمان‌بندی، خروجی و شاخص تهیه کن.",
        },
        {
          id: "add-kpis",
          title: `شاخص‌های ${topic}`,
          description: "KPI و معیار موفقیت",
          icon: "📈",
          prompt:
            "براساس برنامه و موضوع مطرح‌شده در گفتگو، شاخص‌های عملکردی، سنجه‌های ارزیابی و معیارهای موفقیت پیشنهاد بده.",
        },
        {
          id: "risk-analysis",
          title: `ریسک‌های ${topic}`,
          description: "ریسک، پیامد و راهکار کنترل",
          icon: "⚠️",
          prompt:
            "ریسک‌های اجرایی برنامه قبلی را استخراج کن و برای هر ریسک، پیامد، احتمال وقوع و راهکار کنترل ارائه بده.",
        },
        {
          id: "roadmap",
          title: `نقشه راه ${topic}`,
          description: "مراحل اجرایی و زمان‌بندی",
          icon: "🧭",
          prompt:
            "براساس موضوع و برنامه قبلی، یک نقشه راه مرحله‌به‌مرحله، زمان‌بندی‌شده و قابل پیگیری ارائه کن.",
        },
      ];

    case "analysis":
      return [
        {
          id: "strength-weakness",
          title: "نقاط قوت و ضعف بده",
          description: `تحلیل «${topic}»`,
          icon: "🧠",
          prompt:
            "محتوا یا سند قبلی را از نظر نقاط قوت، نقاط ضعف، ابهام‌ها و پیشنهادهای اصلاحی تحلیل کن.",
        },
        {
          id: "rewrite",
          title: "بازنویسی اصلاحی کن",
          description: `نسخه بهتر برای «${topic}»`,
          icon: "✍️",
          prompt:
            "متن قبلی را با حفظ موضوع و معنا، حرفه‌ای‌تر، دقیق‌تر، منسجم‌تر و روان‌تر بازنویسی کن.",
        },
        {
          id: "extract-actions",
          title: "اقدام‌ها را استخراج کن",
          description: `گام‌های بعدی برای «${topic}»`,
          icon: "✅",
          prompt:
            "از محتوای قبلی، اقدام‌های اجرایی، مسئولیت‌ها، اولویت‌ها و گام‌های بعدی را استخراج کن.",
        },
        {
          id: "critical-review",
          title: "نقد جدی‌تر انجام بده",
          description: `بررسی سخت‌گیرانه «${topic}»`,
          icon: "🔎",
          prompt:
            "محتوای قبلی را با نگاه انتقادی و سخت‌گیرانه‌تر بررسی کن و ایرادهای پنهان، ضعف‌های ساختاری و اصلاحات پیشنهادی را ارائه بده.",
        },
      ];

    case "general":
    default:
      return [
        {
          id: "explain-simpler",
          title: "ساده‌تر توضیح بده",
          description: `توضیح روشن‌تر درباره «${topic}»`,
          icon: "💡",
          prompt:
            "همین موضوع را با تکیه بر سابقه گفتگو، ساده‌تر، روشن‌تر و مرحله‌به‌مرحله توضیح بده.",
        },
        {
          id: "give-example",
          title: "مثال بزن",
          description: `مثال کاربردی برای «${topic}»`,
          icon: "🎯",
          prompt:
            "براساس موضوع و پاسخ قبلی، چند مثال کاربردی، واقعی و قابل فهم ارائه کن.",
        },
        {
          id: "next-steps",
          title: "گام بعدی چیست؟",
          description: `مسیر ادامه برای «${topic}»`,
          icon: "🧭",
          prompt:
            "براساس موضوع و نتیجه فعلی گفتگو، گام‌های بعدی را به‌صورت عملی و مرحله‌به‌مرحله پیشنهاد بده.",
        },
      ];
  }
}

export function getSmartFollowUpActions(
  input: SmartFollowUpInput
): SmartFollowUpAction[] {
  const topic = resolveTopic(input);

  const specificActions = getModeActions(
    input.modeId,
    topic
  );

  const commonActions = getCommonActions(topic);

  return [...specificActions, ...commonActions].slice(0, 6);
}