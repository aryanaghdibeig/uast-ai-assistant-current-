// components/chat/AssistantModeSelector.tsx

"use client";

import styles from "@/app/Chat.module.css";
import { assistantModes } from "@/lib/assistant/modes";
import type { AssistantModeId } from "@/types/chat";

type AssistantModeSelectorProps = {
  selectedModeId: AssistantModeId;
  onChangeMode: (modeId: AssistantModeId) => void;
};

export default function AssistantModeSelector({
  selectedModeId,
  onChangeMode,
}: AssistantModeSelectorProps) {
  const selectedMode =
    assistantModes.find((mode) => mode.id === selectedModeId) ||
    assistantModes[0];

  return (
    <div className={styles.modeSelector}>
      <div className={styles.modeSelectorHeader}>
        <span className={styles.modeSelectorLabel}>
          حالت کاری / موتور agent
        </span>
        <span className={styles.modeSelectorCurrent}>
          {selectedMode.icon} {selectedMode.shortTitle}
        </span>
      </div>

      <div className={styles.modeTabs}>
        {assistantModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`${styles.modeTab} ${
              selectedModeId === mode.id ? styles.modeTabActive : ""
            }`}
            onClick={() => onChangeMode(mode.id)}
            title={mode.description}
          >
            <span>{mode.icon}</span>
            <span>{mode.shortTitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}