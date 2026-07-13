// components/chat/ChatSidebar.tsx

"use client";

import styles from "@/app/Chat.module.css";
import type { AssistantModeId } from "@/types/chat";

type SidebarConversation = {
  id: string;
  title: string;
  messagesCount: number;
  assistantMode?: AssistantModeId;
};

type ChatSidebarProps = {
  conversations: SidebarConversation[];
  activeConversationId: string;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

const modeLabels: Record<
  AssistantModeId,
  {
    label: string;
    icon: string;
  }
> = {
  general: {
    label: "عمومی",
    icon: "🎓",
  },
  official_letter: {
    label: "مکاتبات",
    icon: "📄",
  },
  curriculum: {
    label: "برنامه‌درسی",
    icon: "🧩",
  },
  research: {
    label: "پژوهش",
    icon: "🔬",
  },
  content: {
    label: "محتوا",
    icon: "🎬",
  },
  planning: {
    label: "برنامه‌ریزی",
    icon: "📊",
  },
  analysis: {
    label: "تحلیل",
    icon: "🧠",
  },
};

function getModeInfo(modeId?: AssistantModeId) {
  if (!modeId) return modeLabels.general;

  return modeLabels[modeId] || modeLabels.general;
}

function getMessagesLabel(count: number) {
  if (count === 0) return "بدون پیام";
  if (count === 1) return "۱ پیام";

  return `${count.toLocaleString("fa-IR")} پیام`;
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <button
          type="button"
          className={styles.newChatButton}
          onClick={onNewChat}
        >
          + گفتگوی جدید
        </button>
      </div>

      <div className={styles.conversationList}>
        {conversations.length === 0 && (
          <div className={styles.emptyConversationList}>
            هنوز گفتگویی ساخته نشده است.
          </div>
        )}

        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          const modeInfo = getModeInfo(conversation.assistantMode);

          return (
            <div
              key={conversation.id}
              className={`${styles.conversationItem} ${
                isActive ? styles.conversationItemActive : ""
              }`}
            >
              <button
                type="button"
                className={styles.conversationMainButton}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className={styles.conversationTitle}>
                  {conversation.title || "گفتگوی جدید"}
                </span>

                <span className={styles.conversationMetaRow}>
                  <span className={styles.conversationModeBadge}>
                    <span>{modeInfo.icon}</span>
                    <span>{modeInfo.label}</span>
                  </span>

                  <span className={styles.conversationCount}>
                    {getMessagesLabel(conversation.messagesCount)}
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={styles.deleteConversationButton}
                onClick={() => onDeleteConversation(conversation.id)}
                aria-label="حذف گفتگو"
                title="حذف گفتگو"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}