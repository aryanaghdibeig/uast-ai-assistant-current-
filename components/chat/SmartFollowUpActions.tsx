// components/chat/SmartFollowUpActions.tsx

"use client";

import { useState } from "react";
import styles from "@/app/Chat.module.css";
import type { SmartFollowUpAction } from "@/lib/assistant/followups";

type SmartFollowUpActionsProps = {
  actions: SmartFollowUpAction[];
  loading?: boolean;
  source?: string;
  disabled?: boolean;
  onUseAction: (
    action: SmartFollowUpAction
  ) => void | Promise<void>;
};

export default function SmartFollowUpActions({
  actions,
  loading = false,
  source,
  disabled = false,
  onUseAction,
}: SmartFollowUpActionsProps) {
  const [executingActionId, setExecutingActionId] = useState<string | null>(
    null
  );

  if (!loading && actions.length === 0) {
    return null;
  }

  const handleActionClick = async (action: SmartFollowUpAction) => {
    if (loading || disabled || executingActionId) {
      return;
    }

    setExecutingActionId(action.id);

    try {
      await onUseAction(action);
    } catch (error) {
      console.error("Smart action execution error:", error);
    } finally {
      setExecutingActionId(null);
    }
  };

  return (
    <div className={styles.smartActions}>
      <div className={styles.smartActionsHeader}>
        <span>اقدام‌های پیشنهادی بعدی</span>

        <small>
          {loading
            ? "در حال تولید پیشنهادهای هوشمند..."
            : source === "ai"
              ? "تولیدشده با هوش مصنوعی"
              : "پیشنهاد سریع و موضوع‌محور"}
        </small>
      </div>

      {loading ? (
        <div className={styles.smartActionsGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`smart-action-loading-${index}`}
              className={styles.smartActionSkeleton}
            />
          ))}
        </div>
      ) : (
        <div className={styles.smartActionsGrid}>
          {actions.map((action) => {
            const isExecuting = executingActionId === action.id;

            return (
              <button
                key={action.id}
                type="button"
                className={styles.smartActionButton}
                onClick={() => void handleActionClick(action)}
                title={action.description}
                disabled={
                  disabled ||
                  Boolean(executingActionId)
                }
                aria-busy={isExecuting}
              >
                <span className={styles.smartActionIcon}>
                  {isExecuting ? "⏳" : action.icon}
                </span>

                <span className={styles.smartActionText}>
                  <strong>
                    {isExecuting
                      ? "در حال اجرا..."
                      : action.title}
                  </strong>

                  <small>
                    {isExecuting
                      ? "درخواست شما مستقیماً در حال اجرا است."
                      : action.description}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}