// components/chat/WelcomePanel.tsx

"use client";

import DeputyHub from "@/components/chat/DeputyHub";
import type { DeputyId, OrgAgent } from "@/lib/org/deputies";
import type { AssistantModeId } from "@/types/chat";

type WelcomePanelProps = {
  selectedDeputyId: DeputyId | null;
  previewDeputyId: DeputyId | null;
  selectedAgentId: string | null;
  onSelectDeputy: (deputyId: DeputyId) => void;
  onPreviewDeputy: (deputyId: DeputyId | null) => void;
  onSelectAgent: (agent: OrgAgent, deputyId: DeputyId) => void;
  onUsePrompt: (prompt: string, modeId: AssistantModeId) => void;
};

export default function WelcomePanel({
  selectedDeputyId,
  previewDeputyId,
  selectedAgentId,
  onSelectDeputy,
  onPreviewDeputy,
  onSelectAgent,
  onUsePrompt,
}: WelcomePanelProps) {
  return (
    <DeputyHub
      selectedDeputyId={selectedDeputyId}
      previewDeputyId={previewDeputyId}
      selectedAgentId={selectedAgentId}
      onSelectDeputy={onSelectDeputy}
      onPreviewDeputy={onPreviewDeputy}
      onSelectAgent={onSelectAgent}
      onUsePrompt={onUsePrompt}
    />
  );
}
