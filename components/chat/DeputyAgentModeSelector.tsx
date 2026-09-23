"use client";

import styles from "@/app/Chat.module.css";
import {
  getDeputyById,
  type DeputyId,
  type OrgAgent,
} from "@/lib/org/deputies";

type DeputyAgentModeSelectorProps = {
  selectedDeputyId: DeputyId | null;
  selectedAgentId: string | null;
  onSelectAgent: (agent: OrgAgent, deputyId: DeputyId) => void;
};

/**
 * حالت کاری فقط زیرمجموعهٔ معاونت انتخاب‌شده — نه حالت‌های عمومی مستقل.
 * بدون انتخاب معاونت چیزی نشان داده نمی‌شود.
 */
export default function DeputyAgentModeSelector({
  selectedDeputyId,
  selectedAgentId,
  onSelectAgent,
}: DeputyAgentModeSelectorProps) {
  const deputy = getDeputyById(selectedDeputyId);

  if (!deputy) {
    return null;
  }

  const activeAgent = deputy.agents.find(
    (agent) => agent.id === selectedAgentId
  );

  return (
    <div className={styles.modeSelector} data-deputy-zone="mode-selector">
      <div className={styles.modeSelectorHeader}>
        <span className={styles.modeSelectorLabel}>
          حالت کاری · {deputy.shortTitle}
        </span>
        <span className={styles.modeSelectorCurrent}>
          {activeAgent
            ? `${activeAgent.icon} ${activeAgent.title}`
            : "یک agent این معاونت را انتخاب کنید"}
        </span>
      </div>

      <div className={styles.modeTabs} role="tablist" aria-label="حالت کاری معاونت">
        {deputy.agents.map((agent) => {
          const active = agent.id === selectedAgentId;
          return (
            <button
              key={agent.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.modeTab} ${
                active ? styles.modeTabActive : ""
              }`}
              onClick={() => onSelectAgent(agent, deputy.id)}
              title={agent.description}
            >
              <span aria-hidden>{agent.icon}</span>
              <span>{agent.title.replace(/^agent\s+/i, "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
