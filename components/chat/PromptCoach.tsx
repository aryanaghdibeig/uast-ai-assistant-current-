// components/chat/PromptCoach.tsx

"use client";

import Image from "next/image";
import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDeputyById, type DeputyId } from "@/lib/org/deputies";
import { cn } from "@/lib/utils";

type PromptCoachProps = {
  selectedDeputyId: DeputyId | null;
  onInsertPrompt: (prompt: string) => void;
};

const generalTips = [
  {
    id: "clarify",
    title: "واضح‌تر بپرس",
    prompt:
      "لطفاً پاسخ را مرحله‌به‌مرحله، با مثال دانشگاهی و خروجی قابل‌اجرا بنویس. موضوع من: ",
  },
  {
    id: "structure",
    title: "ساختارمند کن",
    prompt:
      "پاسخ را در قالب عنوان، فهرست شماره‌دار، و جمع‌بندی کوتاه ارائه بده. موضوع: ",
  },
  {
    id: "official",
    title: "لحن رسمی",
    prompt:
      "با لحن رسمی دانشگاهی و مختصر بنویس. مخاطب مسئول سازمانی است. موضوع: ",
  },
];

export default function PromptCoach({
  selectedDeputyId,
  onInsertPrompt,
}: PromptCoachProps) {
  const [open, setOpen] = useState(false);
  const deputy = getDeputyById(selectedDeputyId);

  const tips = useMemo(() => {
    if (!deputy) return generalTips;
    return [
      ...deputy.starterPrompts.map((item) => ({
        id: item.id,
        title: item.title,
        prompt: item.prompt,
      })),
      ...generalTips.slice(0, 1),
    ];
  }, [deputy]);

  return (
    <div
      className={cn(
        "fixed bottom-[min(38vh,260px)] left-[20px] z-40 flex flex-col items-start gap-2.5",
        "max-[720px]:bottom-[min(32vh,200px)] max-[720px]:left-3"
      )}
    >
      {open ? (
        <Card
          className="w-[min(320px,calc(100vw-36px))] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-label="کمک‌دستیار ساخت پرامپت"
        >
          <CardHeader className="relative gap-2 border-b border-[var(--border)] bg-[linear-gradient(135deg,color-mix(in_srgb,#134e4a_16%,transparent),transparent_70%)] p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="h-14 w-14 overflow-hidden rounded-xl">
                <Image
                  src="/brand/scenes/prompt-coach.svg"
                  alt=""
                  width={72}
                  height={72}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm">کمک‌دستیار ساخت پرامپت</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {deputy
                    ? `پیشنهادهای ویژه ${deputy.shortTitle}`
                    : "پیشنهادهای عمومی برای شروع بهتر"}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => setOpen(false)}
                aria-label="بستن کمک‌دستیار پرامپت"
              >
                <X />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex max-h-[min(360px,50vh)] flex-col gap-2 overflow-y-auto p-3">
            {tips.map((tip) => (
              <button
                key={tip.id}
                type="button"
                className="flex w-full flex-col items-start gap-1 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-2.5 text-right transition hover:border-[var(--accent)] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
                onClick={() => {
                  onInsertPrompt(tip.prompt);
                  setOpen(false);
                }}
              >
                <span className="text-[13px] font-bold text-[var(--text)]">
                  {tip.title}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  درج در کادر پیام
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Button
        type="button"
        className="h-auto gap-2.5 rounded-full bg-[#0f172a] px-3.5 py-2 text-[#ecfeff] shadow-[0_14px_36px_rgba(15,23,42,0.28)] hover:bg-[#134e4a] max-[720px]:px-2"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="باز کردن کمک‌دستیار ساخت پرامپت"
      >
        <Image
          src="/brand/scenes/prompt-coach.svg"
          alt=""
          width={44}
          height={44}
          className="rounded-full"
          unoptimized
        />
        <span className="inline-flex items-center gap-1.5 max-[720px]:hidden">
          <Sparkles className="size-3.5" />
          ساخت پرامپت
        </span>
        {deputy ? (
          <Badge
            variant="secondary"
            className="border-white/10 bg-white/10 text-[#ccfbf1] max-[720px]:hidden"
          >
            {deputy.shortTitle}
          </Badge>
        ) : null}
      </Button>
    </div>
  );
}
