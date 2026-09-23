// components/chat/DeputyHub.tsx

"use client";

import { useMemo, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpandingCards } from "@/components/ui/expanding-cards";
import {
  deputyExpandingItems,
  deputyIdFromExpandingItem,
} from "@/components/ui/expanding-cards-demo";
import styles from "@/app/Chat.module.css";
import {
  getDeputyById,
  type DeputyId,
  type OrgAgent,
} from "@/lib/org/deputies";
import { cn } from "@/lib/utils";
import type { AssistantModeId } from "@/types/chat";

type DeputyHubProps = {
  selectedDeputyId: DeputyId | null;
  previewDeputyId: DeputyId | null;
  selectedAgentId: string | null;
  onSelectDeputy: (deputyId: DeputyId) => void;
  onPreviewDeputy: (deputyId: DeputyId | null) => void;
  onSelectAgent: (agent: OrgAgent, deputyId: DeputyId) => void;
  onUsePrompt: (prompt: string, modeId: AssistantModeId) => void;
};

export default function DeputyHub({
  selectedDeputyId,
  previewDeputyId,
  selectedAgentId,
  onSelectDeputy,
  onPreviewDeputy,
  onSelectAgent,
  onUsePrompt,
}: DeputyHubProps) {
  const activeDeputy = getDeputyById(selectedDeputyId);
  const focusDeputy = getDeputyById(previewDeputyId ?? selectedDeputyId);
  const accent = focusDeputy?.accent ?? "#0d9488";

  const expandingActiveIndex = useMemo(() => {
    const focusId = previewDeputyId ?? selectedDeputyId;
    if (!focusId) return null;
    const idx = deputyExpandingItems.findIndex(
      (item) => String(item.id) === focusId
    );
    return idx >= 0 ? idx : null;
  }, [previewDeputyId, selectedDeputyId]);

  return (
    <div
      className={styles.deputyHub}
      style={
        {
          "--deputy-scene-accent": accent,
        } as CSSProperties
      }
      data-scene={focusDeputy?.id ?? "default"}
      data-deputy-zone="hub"
    >
      <div className={styles.deputyHubContent}>
        {/* اعلان فشرده — متن قبلی، ظاهر کوچک مثل علامت اعلان */}
        <aside
          className={styles.deputyNotice}
          role="status"
          aria-label="راهنمای انتخاب معاونت"
        >
          <span className={styles.deputyNoticeDot} aria-hidden="true" />
          <div className={styles.deputyNoticeBody}>
            <p className={styles.deputyNoticeBrand}>
              دانشگاه جامع علمی‌کاربردی
              <span className={styles.deputyNoticeSep}>·</span>
              شبکه agentهای هوشمند سازمانی
            </p>
            <p className={styles.deputyNoticeTitle}>
              معاونت خود را انتخاب کنید؛ agent مناسب مسیر گفتگو را می‌سازد
            </p>
            <p className={styles.deputyNoticeMeta}>
              کل صفحه با انتخاب هر معاونت فضای بصری همان حوزه را می‌گیرد
              {focusDeputy ? (
                <>
                  <span className={styles.deputyNoticeSep}>·</span>
                  <span aria-live="polite">{focusDeputy.scene.mood}</span>
                </>
              ) : null}
            </p>
          </div>
        </aside>

        <section
          className={styles.deputyShowcase}
          aria-labelledby="deputies-heading"
        >
          <div className={styles.welcomeSectionHeader}>
            <h2 id="deputies-heading">معاونت‌ها</h2>
            <span className={styles.deputyShowcaseHint}>
              لمس یا کلیک کنید
            </span>
          </div>

          <ExpandingCards
            className={styles.deputyExpandingCards}
            items={deputyExpandingItems}
            activeIndex={expandingActiveIndex}
            onActiveIndexChange={(index) => {
              const deputyId = deputyIdFromExpandingItem(
                deputyExpandingItems[index]
              );
              if (deputyId) onPreviewDeputy(deputyId);
            }}
            onItemSelect={(item) => {
              const deputyId = deputyIdFromExpandingItem(item);
              if (deputyId) onSelectDeputy(deputyId);
            }}
            onMouseLeave={() => onPreviewDeputy(null)}
          />
        </section>

        {activeDeputy ? (
          <section
            className={styles.welcomeSection}
            aria-labelledby="agents-heading"
          >
            <div className={styles.welcomeSectionHeader}>
              <h2 id="agents-heading">
                حالت کاری · {activeDeputy.shortTitle}
              </h2>
              <span>agentهای همین معاونت — نه حالت‌های عمومی</span>
            </div>

            <div className={styles.agentGrid}>
              {activeDeputy.agents.map((agent) => {
                const active = agent.id === selectedAgentId;
                return (
                  <Card
                    key={agent.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    className={cn(
                      "cursor-pointer touch-manipulation transition-all duration-200 hover:border-[var(--accent)]",
                      active &&
                        "border-[var(--accent-strong)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    )}
                    onClick={() => onSelectAgent(agent, activeDeputy.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectAgent(agent, activeDeputy.id);
                      }
                    }}
                  >
                    <CardHeader className="gap-2 p-4 pb-2">
                      <span className="text-[22px]" aria-hidden="true">
                        {agent.icon}
                      </span>
                      <CardTitle className="text-sm">{agent.title}</CardTitle>
                      <CardDescription className="text-xs leading-7">
                        {agent.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Badge variant="warning">دانش معاونت به‌زودی</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className={styles.starterRow}>
              {activeDeputy.starterPrompts.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => onUsePrompt(item.prompt, item.modeId)}
                >
                  {item.title}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
