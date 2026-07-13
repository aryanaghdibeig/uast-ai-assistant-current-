// lib/assistant/modes.ts

import type { AssistantMode, QuickAction } from "@/types/chat";

export const assistantModes: AssistantMode[] = [
  {
    id: "general",
    title: "دستیار عمومی دانشگاه",
    shortTitle: "عمومی",
    description:
      "پاسخ‌گویی رسمی و دقیق به پرسش‌های عمومی، آموزشی، اداری و دانشگاهی.",
    icon: "🎓",
    placeholder: "پرسش خود را درباره دانشگاه، آموزش، مهارت یا امور اداری بنویسید...",
  },
  {
    id: "official_letter",
    title: "دستیار مکاتبات اداری",
    shortTitle: "مکاتبات",
    description:
      "تدوین نامه، گزارش، صورتجلسه، ابلاغ، پیشنهاد و متن‌های رسمی سازمانی.",
    icon: "📄",
    placeholder: "موضوع نامه یا متن اداری مورد نظر را بنویسید...",
  },
  {
    id: "curriculum",
    title: "دستیار برنامه‌درسی و مهارتی",
    shortTitle: "برنامه‌درسی",
    description:
      "کمک به طراحی دوره، سرفصل، شایستگی، واحد یادگیری و برنامه آموزشی مهارت‌محور.",
    icon: "🧩",
    placeholder: "موضوع دوره، شایستگی یا برنامه آموزشی را بنویسید...",
  },
  {
    id: "research",
    title: "دستیار پژوهش و فناوری",
    shortTitle: "پژوهش",
    description:
      "کمک در طراحی طرح پژوهشی، بیان مسئله، مدل مفهومی، گزارش علمی و تحلیل منابع.",
    icon: "🔬",
    placeholder: "موضوع پژوهش، مسئله یا ایده تحقیقاتی خود را بنویسید...",
  },
  {
    id: "content",
    title: "دستیار تولید محتوا",
    shortTitle: "محتوا",
    description:
      "تولید سناریوی آموزشی، متن سخنرانی، محتوای کلاس، پست خبری و محتوای دیجیتال.",
    icon: "🎬",
    placeholder: "موضوع محتوای آموزشی، خبری یا رسانه‌ای را بنویسید...",
  },
  {
    id: "planning",
    title: "دستیار برنامه‌ریزی و مدیریت",
    shortTitle: "برنامه‌ریزی",
    description:
      "کمک در تدوین نقشه راه، برنامه عملیاتی، شاخص، اقدام، ریسک و گزارش مدیریتی.",
    icon: "📊",
    placeholder: "هدف، برنامه، شاخص یا مسئله مدیریتی خود را بنویسید...",
  },
  {
    id: "analysis",
    title: "دستیار تحلیل اسناد",
    shortTitle: "تحلیل",
    description:
      "کمک در تحلیل متن، استخراج نکات، نقد ساختار، خلاصه‌سازی و آماده‌سازی گزارش.",
    icon: "🧠",
    placeholder: "متن، موضوع سند یا نوع تحلیلی که می‌خواهید را بنویسید...",
  },
];

export const quickActions: QuickAction[] = [
  {
    id: "write-official-letter",
    title: "نامه اداری بنویس",
    description: "برای مکاتبات رسمی دانشگاهی و سازمانی",
    prompt:
      "یک نامه اداری رسمی و دقیق تهیه کن. موضوع نامه این است: ",
    modeId: "official_letter",
    icon: "📄",
  },
  {
    id: "create-roadmap",
    title: "نقشه راه تدوین کن",
    description: "برای پروژه، مرکز، طرح یا برنامه اجرایی",
    prompt:
      "یک نقشه راه مرحله‌به‌مرحله، اجرایی و قابل پیگیری برای موضوع زیر تدوین کن: ",
    modeId: "planning",
    icon: "🧭",
  },
  {
    id: "design-course",
    title: "دوره آموزشی طراحی کن",
    description: "هدف، سرفصل، شایستگی و خروجی یادگیری",
    prompt:
      "یک دوره آموزشی مهارت‌محور طراحی کن. موضوع دوره این است: ",
    modeId: "curriculum",
    icon: "🧩",
  },
  {
    id: "research-proposal",
    title: "طرح پژوهشی بساز",
    description: "بیان مسئله، اهداف، روش و خروجی‌ها",
    prompt:
      "یک طرح پژوهشی حرفه‌ای برای موضوع زیر تدوین کن: ",
    modeId: "research",
    icon: "🔬",
  },
  {
    id: "content-plan",
    title: "محتوای آموزشی تولید کن",
    description: "سناریو، متن درس، اسلاید یا محتوای دیجیتال",
    prompt:
      "برای موضوع زیر یک محتوای آموزشی ساختاریافته و کاربردی تولید کن: ",
    modeId: "content",
    icon: "🎬",
  },
  {
    id: "analyze-document",
    title: "تحلیل سند انجام بده",
    description: "نقاط قوت، ضعف، اصلاحات و پیشنهادها",
    prompt:
      "متن یا سند زیر را تحلیل کن و نقاط قوت، ضعف و پیشنهادهای اصلاحی آن را ارائه بده: ",
    modeId: "analysis",
    icon: "🧠",
  },
];