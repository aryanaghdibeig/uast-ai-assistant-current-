// lib/org/deputies.ts
// Catalog of university deputies + agents for UI hub.
// Each agent maps to an existing AssistantModeId so chat/memory/files keep working.
// Knowledge/RAG per deputy is scaffolded only (not active).

import type { AssistantModeId } from "@/types/chat";

export type DeputyId =
  | "cultural"
  | "support"
  | "research"
  | "education"
  | "international";

export type OrgAgent = {
  id: string;
  title: string;
  description: string;
  /** Existing chat mode — no new DB constraint. */
  modeId: AssistantModeId;
  icon: string;
  /** Future RAG corpus key; unused until FEATURE_DOCUMENT_RAG. */
  knowledgeScope: string;
  ragReady: false;
};

export type DeputyScene = {
  /** Soft atmosphere image under the hub (kept low-contrast for comfort). */
  image: string;
  /** CSS object-position for thematic crop. */
  position: string;
  /** Soft wash color mixed over the image. */
  wash: string;
  /** Short label shown near the scene. */
  mood: string;
};

export type Deputy = {
  id: DeputyId;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  icon: string;
  scene: DeputyScene;
  agents: OrgAgent[];
  starterPrompts: Array<{
    id: string;
    title: string;
    prompt: string;
    modeId: AssistantModeId;
  }>;
};

export const defaultHubScene: DeputyScene = {
  image: "/brand/scenes/space.svg",
  position: "50% 42%",
  wash: "color-mix(in srgb, #1e1b4b 8%, transparent)",
  mood: "فضای عمیق",
};

export const deputies: Deputy[] = [
  {
    id: "cultural",
    title: "معاونت فرهنگی",
    shortTitle: "فرهنگی",
    description:
      "رویدادها، اردوها، تشکل‌ها، محتوای فرهنگی و ارتباط با دانشجو.",
    accent: "#0d9488",
    icon: "🎭",
    scene: {
      image: "/brand/scenes/cultural.svg",
      position: "50% 45%",
      wash: "color-mix(in srgb, #f59e0b 12%, transparent)",
      mood: "تعامل و رویداد فرهنگی",
    },
    agents: [
      {
        id: "cultural-events",
        title: "agent رویداد و برنامه",
        description: "طراحی برنامه فرهنگی، تقویم و گزارش رویداد",
        modeId: "planning",
        icon: "📅",
        knowledgeScope: "deputy:cultural:events",
        ragReady: false,
      },
      {
        id: "cultural-content",
        title: "agent محتوای فرهنگی",
        description: "متن اطلاعیه، پوستر مفهومی و محتوای رسانه‌ای",
        modeId: "content",
        icon: "🎬",
        knowledgeScope: "deputy:cultural:content",
        ragReady: false,
      },
      {
        id: "cultural-docs",
        title: "agent اسناد فرهنگی",
        description: "تحلیل آیین‌نامه و استخراج نکات اجرایی",
        modeId: "analysis",
        icon: "🧠",
        knowledgeScope: "deputy:cultural:docs",
        ragReady: false,
      },
    ],
    starterPrompts: [
      {
        id: "cultural-calendar",
        title: "تقویم فرهنگی فصلی",
        prompt:
          "یک تقویم فرهنگی فصلی برای دانشگاه جامع علمی‌کاربردی با محورهای دانشجویی، مناسبت‌ها و ارزیابی اثر تدوین کن: ",
        modeId: "planning",
      },
      {
        id: "cultural-announce",
        title: "اطلاعیه رویداد",
        prompt:
          "یک اطلاعیه رسمی و جذاب برای رویداد فرهنگی دانشگاه بنویس. موضوع رویداد: ",
        modeId: "content",
      },
    ],
  },
  {
    id: "support",
    title: "معاونت پشتیبانی",
    shortTitle: "پشتیبانی",
    description:
      "اداری، رفاهی، منابع انسانی، مکاتبات و پشتیبانی عملیاتی واحدها.",
    accent: "#1a365d",
    icon: "🏛️",
    scene: {
      image: "/brand/scenes/support.svg",
      position: "50% 50%",
      wash: "color-mix(in srgb, #1a365d 12%, transparent)",
      mood: "عملیات و پشتیبانی",
    },
    agents: [
      {
        id: "support-letters",
        title: "agent مکاتبات اداری",
        description: "نامه، ابلاغ، صورتجلسه و متن‌های رسمی",
        modeId: "official_letter",
        icon: "📄",
        knowledgeScope: "deputy:support:letters",
        ragReady: false,
      },
      {
        id: "support-ops",
        title: "agent عملیات و رفاه",
        description: "برنامه اجرایی، چک‌لیست و گزارش پشتیبانی",
        modeId: "planning",
        icon: "📊",
        knowledgeScope: "deputy:support:ops",
        ragReady: false,
      },
      {
        id: "support-general",
        title: "agent راهنمای اداری",
        description: "پاسخ‌گویی عمومی به فرایندهای پشتیبانی",
        modeId: "general",
        icon: "🎓",
        knowledgeScope: "deputy:support:faq",
        ragReady: false,
      },
    ],
    starterPrompts: [
      {
        id: "support-letter",
        title: "نامه اداری",
        prompt:
          "یک نامه اداری رسمی دانشگاهی بنویس. موضوع نامه: ",
        modeId: "official_letter",
      },
      {
        id: "support-checklist",
        title: "چک‌لیست پشتیبانی",
        prompt:
          "یک چک‌لیست عملیاتی برای فرایند پشتیبانی واحد دانشگاهی تهیه کن. موضوع: ",
        modeId: "planning",
      },
    ],
  },
  {
    id: "research",
    title: "معاونت پژوهشی",
    shortTitle: "پژوهشی",
    description:
      "طرح‌های پژوهشی، فناوری، گزارش علمی و تحلیل منابع تحقیقاتی.",
    accent: "#0f766e",
    icon: "🔬",
    scene: {
      image: "/brand/scenes/research.svg",
      position: "50% 45%",
      wash: "color-mix(in srgb, #0f766e 8%, transparent)",
      mood: "تحلیل و پژوهش",
    },
    agents: [
      {
        id: "research-proposal",
        title: "agent طرح پژوهشی",
        description: "بیان مسئله، اهداف، روش و خروجی",
        modeId: "research",
        icon: "🔬",
        knowledgeScope: "deputy:research:proposals",
        ragReady: false,
      },
      {
        id: "research-analysis",
        title: "agent تحلیل علمی",
        description: "خلاصه، نقد و استخراج نکات از اسناد",
        modeId: "analysis",
        icon: "🧠",
        knowledgeScope: "deputy:research:papers",
        ragReady: false,
      },
      {
        id: "research-plan",
        title: "agent نقشه راه تحقیق",
        description: "برنامه‌زمانی و شاخص‌های پیشرفت پژوهش",
        modeId: "planning",
        icon: "🧭",
        knowledgeScope: "deputy:research:roadmap",
        ragReady: false,
      },
    ],
    starterPrompts: [
      {
        id: "research-draft",
        title: "پیش‌نویس طرح",
        prompt:
          "یک طرح پژوهشی حرفه‌ای برای موضوع زیر تدوین کن: ",
        modeId: "research",
      },
      {
        id: "research-review",
        title: "مرور ادبیات کوتاه",
        prompt:
          "یک مرور ادبیات کوتاه و ساخت‌یافته برای موضوع پژوهشی زیر بنویس: ",
        modeId: "analysis",
      },
    ],
  },
  {
    id: "education",
    title: "معاونت آموزشی",
    shortTitle: "آموزشی",
    description:
      "برنامه‌درسی، دوره مهارتی، ارزشیابی یادگیری و محتوای آموزشی.",
    accent: "#1d4ed8",
    icon: "📚",
    scene: {
      image: "/brand/scenes/education.svg",
      position: "50% 40%",
      wash: "color-mix(in srgb, #1d4ed8 12%, transparent)",
      mood: "یادگیری و محتوا",
    },
    agents: [
      {
        id: "edu-curriculum",
        title: "agent برنامه‌درسی",
        description: "سرفصل، شایستگی و واحد یادگیری",
        modeId: "curriculum",
        icon: "🧩",
        knowledgeScope: "deputy:education:curriculum",
        ragReady: false,
      },
      {
        id: "edu-content",
        title: "agent محتوای کلاس",
        description: "سناریوی درس، اسلاید و متن آموزشی",
        modeId: "content",
        icon: "🎬",
        knowledgeScope: "deputy:education:materials",
        ragReady: false,
      },
      {
        id: "edu-general",
        title: "agent راهنمای آموزشی",
        description: "پرسش‌های عمومی آموزشی و اداری مرتبط",
        modeId: "general",
        icon: "🎓",
        knowledgeScope: "deputy:education:faq",
        ragReady: false,
      },
    ],
    starterPrompts: [
      {
        id: "edu-course",
        title: "طراحی دوره",
        prompt:
          "یک دوره آموزشی مهارت‌محور طراحی کن. موضوع دوره: ",
        modeId: "curriculum",
      },
      {
        id: "edu-lesson",
        title: "سناریوی جلسه",
        prompt:
          "یک سناریوی کامل جلسه آموزشی برای موضوع زیر بنویس: ",
        modeId: "content",
      },
    ],
  },
  {
    id: "international",
    title: "امور بین‌الملل",
    shortTitle: "بین‌الملل",
    description:
      "همکاری‌های بین‌المللی، مکاتبات خارجی، معرفی و برنامه‌های تبادل.",
    accent: "#0369a1",
    icon: "🌍",
    scene: {
      image: "/brand/scenes/international.svg",
      position: "50% 45%",
      wash: "color-mix(in srgb, #0369a1 12%, transparent)",
      mood: "شبکه جهانی",
    },
    agents: [
      {
        id: "intl-letters",
        title: "agent مکاتبات بین‌الملل",
        description: "نامه و ایمیل رسمی دو‌زبانه یا رسمی",
        modeId: "official_letter",
        icon: "📄",
        knowledgeScope: "deputy:international:letters",
        ragReady: false,
      },
      {
        id: "intl-content",
        title: "agent معرفی بین‌المللی",
        description: "متن معرفی دانشگاه، بروشور و محتوای وب",
        modeId: "content",
        icon: "🌐",
        knowledgeScope: "deputy:international:promo",
        ragReady: false,
      },
      {
        id: "intl-plan",
        title: "agent همکاری و تفاهم",
        description: "چارچوب همکاری، نقشه راه و پیگیری",
        modeId: "planning",
        icon: "🤝",
        knowledgeScope: "deputy:international:mou",
        ragReady: false,
      },
    ],
    starterPrompts: [
      {
        id: "intl-email",
        title: "ایمیل رسمی خارجی",
        prompt:
          "یک ایمیل رسمی بین‌المللی برای همکاری دانشگاهی بنویس. موضوع: ",
        modeId: "official_letter",
      },
      {
        id: "intl-intro",
        title: "معرفی کوتاه دانشگاه",
        prompt:
          "یک معرفی حرفه‌ای و کوتاه از دانشگاه جامع علمی‌کاربردی برای مخاطب بین‌المللی بنویس با تمرکز بر: ",
        modeId: "content",
      },
    ],
  },
];

export function getDeputyById(id: DeputyId | null | undefined): Deputy | null {
  if (!id) return null;
  return deputies.find((d) => d.id === id) ?? null;
}

export function getAgentById(
  deputyId: DeputyId,
  agentId: string
): OrgAgent | null {
  const deputy = getDeputyById(deputyId);
  return deputy?.agents.find((a) => a.id === agentId) ?? null;
}

/** برچسب کوتاه برای UI بر اساس agent معاونت (نه نام حالت عمومی). */
export function getOrgLabelForMode(modeId: AssistantModeId): {
  label: string;
  icon: string;
  deputyShortTitle?: string;
} {
  for (const deputy of deputies) {
    const agent = deputy.agents.find((a) => a.modeId === modeId);
    if (agent) {
      return {
        label: agent.title.replace(/^agent\s+/i, ""),
        icon: agent.icon,
        deputyShortTitle: deputy.shortTitle,
      };
    }
  }

  return { label: "سازمانی", icon: "🏛️" };
}
