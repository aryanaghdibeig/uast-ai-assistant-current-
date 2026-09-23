"use client";

import type { ReactNode } from "react";
import {
  BookOpen,
  FlaskConical,
  Globe2,
  Landmark,
  PartyPopper,
} from "lucide-react";
import { ExpandingCards, type CardItem } from "@/components/ui/expanding-cards";
import { deputies, type DeputyId } from "@/lib/org/deputies";

const deputyIcons: Record<DeputyId, ReactNode> = {
  cultural: <PartyPopper size={24} aria-hidden />,
  support: <Landmark size={24} aria-hidden />,
  research: <FlaskConical size={24} aria-hidden />,
  education: <BookOpen size={24} aria-hidden />,
  international: <Globe2 size={24} aria-hidden />,
};

/** دادهٔ معاونت‌ها برای هاب — متن کامل از کاتالوگ deputies */
export const deputyExpandingItems: CardItem[] = deputies.map((deputy) => ({
  id: deputy.id,
  title: deputy.title,
  description: deputy.description,
  imgSrc: deputy.scene.image,
  icon: deputyIcons[deputy.id],
  linkHref: `#${deputy.id}`,
}));

export function deputyIdFromExpandingItem(
  item: CardItem
): DeputyId | null {
  const id = String(item.id);
  if (
    id === "cultural" ||
    id === "support" ||
    id === "research" ||
    id === "education" ||
    id === "international"
  ) {
    return id;
  }
  return null;
}

/** دموی عمومی با تصاویر Unsplash (مستقل از هاب) */
export const expandingCardsShowcaseItems: CardItem[] = [
  {
    id: "campus",
    title: "پردیس دانشگاهی",
    description:
      "فضای یادگیری و زندگی دانشجویی در دانشگاه جامع علمی‌کاربردی.",
    imgSrc:
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80",
    icon: <Landmark size={24} aria-hidden />,
    linkHref: "#",
  },
  {
    id: "lab",
    title: "آزمایشگاه و پژوهش",
    description: "تحقیق کاربردی، فناوری و تحلیل داده‌های علمی.",
    imgSrc:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80",
    icon: <FlaskConical size={24} aria-hidden />,
    linkHref: "#",
  },
  {
    id: "library",
    title: "کتابخانه و آموزش",
    description: "منابع آموزشی، دوره مهارتی و طراحی یادگیری.",
    imgSrc:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80",
    icon: <BookOpen size={24} aria-hidden />,
    linkHref: "#",
  },
  {
    id: "culture",
    title: "فرهنگ و رویداد",
    description: "برنامه‌های فرهنگی، تشکل‌ها و ارتباط با دانشجو.",
    imgSrc:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
    icon: <PartyPopper size={24} aria-hidden />,
    linkHref: "#",
  },
  {
    id: "world",
    title: "شبکه بین‌الملل",
    description: "همکاری جهانی و معرفی دانشگاه در عرصه بین‌المللی.",
    imgSrc:
      "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
    icon: <Globe2 size={24} aria-hidden />,
    linkHref: "#",
  },
];

export function ExpandingCardsShowcase() {
  return (
    <div
      dir="rtl"
      className="flex w-full flex-col items-center justify-center space-y-8 bg-[var(--bg)] p-4 font-[family-name:var(--font-sans)] md:p-8"
    >
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] sm:text-4xl">
          شگفتی‌های معماری یادگیری
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
          روی هر کارت هاور یا کلیک کنید تا داستان همان حوزه باز شود.
        </p>
      </div>
      <ExpandingCards
        items={expandingCardsShowcaseItems}
        defaultActiveIndex={null}
      />
    </div>
  );
}
