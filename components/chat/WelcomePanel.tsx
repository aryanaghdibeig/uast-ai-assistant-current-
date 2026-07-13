// components/chat/WelcomePanel.tsx

"use client";

import styles from "@/app/Chat.module.css";
import { assistantModes, quickActions } from "@/lib/assistant/modes";
import type { AssistantModeId, QuickAction } from "@/types/chat";

type WelcomePanelProps = {
  selectedModeId: AssistantModeId;
  onSelectMode: (modeId: AssistantModeId) => void;
  onUsePrompt: (prompt: string, modeId: AssistantModeId) => void;
};

export default function WelcomePanel({
  selectedModeId,
  onSelectMode,
  onUsePrompt,
}: WelcomePanelProps) {
  const selectedMode =
    assistantModes.find((mode) => mode.id === selectedModeId) ||
    assistantModes[0];

  const filteredActions = quickActions.filter(
    (action) => action.modeId === selectedModeId || selectedModeId === "general"
  );

  const actionsToShow =
    filteredActions.length > 0 ? filteredActions : quickActions.slice(0, 4);

  const handleActionClick = (action: QuickAction) => {
    onUsePrompt(action.prompt, action.modeId);
  };

  return (
    <div className={styles.welcomePanel}>
      <div className={styles.welcomeHero}>
        <div className={styles.welcomeBadge}>
          <span>نسخه پیشرفته دستیار</span>
        </div>

        <h1 className={styles.welcomeTitle}>
          امروز چه کاری را با دستیار هوشمند انجام می‌دهید؟
        </h1>

        <p className={styles.welcomeText}>
          این دستیار برای امور دانشگاهی، مهارتی، پژوهشی، تولید محتوا، مکاتبات
          اداری و تحلیل اسناد طراحی شده است. ابتدا حالت کاری را انتخاب کنید یا
          از اقدام‌های سریع شروع کنید.
        </p>

        <div className={styles.selectedModeCard}>
          <div className={styles.selectedModeIcon}>{selectedMode.icon}</div>

          <div>
            <div className={styles.selectedModeTitle}>
              {selectedMode.title}
            </div>
            <div className={styles.selectedModeDescription}>
              {selectedMode.description}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.welcomeSection}>
        <div className={styles.welcomeSectionHeader}>
          <h2>انتخاب مأموریت دستیار</h2>
          <span>هر حالت، سبک پاسخ‌گویی متفاوتی دارد</span>
        </div>

        <div className={styles.modeGrid}>
          {assistantModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`${styles.modeCard} ${
                selectedModeId === mode.id ? styles.modeCardActive : ""
              }`}
              onClick={() => onSelectMode(mode.id)}
            >
              <div className={styles.modeCardIcon}>{mode.icon}</div>
              <div className={styles.modeCardTitle}>{mode.title}</div>
              <div className={styles.modeCardText}>{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.welcomeSection}>
        <div className={styles.welcomeSectionHeader}>
          <h2>شروع سریع</h2>
          <span>با یک کلیک، مسیر گفتگو را مشخص کنید</span>
        </div>

        <div className={styles.quickActionGrid}>
          {actionsToShow.map((action) => (
            <button
              key={action.id}
              type="button"
              className={styles.quickActionCard}
              onClick={() => handleActionClick(action)}
            >
              <div className={styles.quickActionIcon}>{action.icon}</div>
              <div className={styles.quickActionTitle}>{action.title}</div>
              <div className={styles.quickActionText}>
                {action.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}