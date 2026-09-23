// components/chat/SmartFollowUpActions.tsx

"use client";

import { useCallback, useState } from "react";
import {
  Suggestion,
  SuggestionList,
  Suggestions,
} from "@/components/ui/suggestions";
import { cn } from "@/lib/utils";
import type { SmartFollowUpAction } from "@/lib/assistant/followups";

type SmartFollowUpActionsProps = {
  actions: SmartFollowUpAction[];
  loading?: boolean;
  source?: string;
  disabled?: boolean;
  onUseAction: (action: SmartFollowUpAction) => void | Promise<void>;
};

export default function SmartFollowUpActions({
  actions,
  loading = false,
  source,
  disabled = false,
  onUseAction,
}: SmartFollowUpActionsProps) {
  const [executingActionId, setExecutingActionId] = useState<string | null>(
    null,
  );

  const handleSelect = useCallback(
    async (actionId: string) => {
      if (loading || disabled || executingActionId) {
        return;
      }

      const action = actions.find((item) => item.id === actionId);
      if (!action) {
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
    },
    [actions, disabled, executingActionId, loading, onUseAction],
  );

  if (!loading && actions.length === 0) {
    return null;
  }

  const subtitle = loading
    ? "در حال تولید پیشنهادهای هوشمند..."
    : source === "ai"
      ? "تولیدشده با هوش مصنوعی"
      : "پیشنهاد سریع و موضوع‌محور";

  return (
    <section
      dir="rtl"
      className={cn(
        "mx-auto mb-6 mt-2.5 w-[min(760px,92%)] rounded-2xl border border-border/70",
        "bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-3.5 shadow-sm backdrop-blur-md",
        "sm:w-[min(760px,96%)]",
      )}
      aria-label="اقدام‌های پیشنهادی بعدی"
    >
      <Suggestions
        onSelect={(value) => {
          void handleSelect(value);
        }}
        className="gap-3"
      >
        <div className="flex w-full flex-wrap items-baseline justify-between gap-2 px-1">
          <span className="text-[13px] font-extrabold text-foreground">
            اقدام‌های پیشنهادی بعدی
          </span>
          <small className="text-[11px] text-muted-foreground">{subtitle}</small>
        </div>

        {loading ? (
          <SuggestionList className="max-w-none justify-start sm:justify-center">
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={`smart-suggestion-skeleton-${index}`}
                className="h-8 w-28 animate-pulse rounded-full bg-muted"
                aria-hidden="true"
              />
            ))}
          </SuggestionList>
        ) : (
          <SuggestionList className="max-w-none justify-start sm:justify-center">
            {actions.map((action) => {
              const isExecuting = executingActionId === action.id;

              return (
                <Suggestion
                  key={action.id}
                  value={action.id}
                  variant="filled"
                  title={action.description}
                  disabled={disabled || Boolean(executingActionId)}
                  aria-busy={isExecuting}
                  className={cn(
                    "max-w-full truncate text-[var(--text)]",
                    isExecuting && "opacity-80",
                  )}
                >
                  {isExecuting
                    ? "⏳ در حال اجرا..."
                    : `${action.icon} ${action.title}`}
                </Suggestion>
              );
            })}
          </SuggestionList>
        )}
      </Suggestions>
    </section>
  );
}
