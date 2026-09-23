// components/chat/ChatSidebar.tsx

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Search,
  X,
  Command,
} from "lucide-react";
import styles from "@/app/Chat.module.css";
import {
  SidebarNav,
  type NavGroupData,
  type NavItemData,
} from "@/components/ui/dashboard-sidebar";
import SidebarChatLibrary from "@/components/chat/SidebarChatLibrary";
import {
  createFolderId,
  loadSidebarOrg,
  pruneSidebarOrg,
  saveSidebarOrg,
  type SidebarOrgState,
  EMPTY_SIDEBAR_ORG,
} from "@/lib/chat/sidebar-org";
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
  onLogout?: () => void;
  userEmail?: string;
  planLabel?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onLogout,
  userEmail,
  planLabel = "دستیار سازمانی",
  isMobileOpen = false,
  onMobileClose,
}: ChatSidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const orgUserKey = userEmail?.trim() || "anonymous";
  const [org, setOrg] = useState<SidebarOrgState>(EMPTY_SIDEBAR_ORG);
  const [orgReady, setOrgReady] = useState(false);

  const workspaceName = "UAST AI";
  const workspaces = useMemo(
    () => (userEmail ? [workspaceName, userEmail] : [workspaceName]),
    [userEmail]
  );

  useEffect(() => {
    const loaded = loadSidebarOrg(orgUserKey);
    setOrg(loaded);
    setOrgReady(true);
  }, [orgUserKey]);

  useEffect(() => {
    if (!orgReady) return;
    const ids = new Set(conversations.map((c) => c.id));
    const pruned = pruneSidebarOrg(org, ids);
    const changed =
      pruned.pinnedIds.length !== org.pinnedIds.length ||
      Object.keys(pruned.folderByConversationId).length !==
        Object.keys(org.folderByConversationId).length;
    if (changed) {
      setOrg(pruned);
      return;
    }
    saveSidebarOrg(orgUserKey, org);
  }, [org, orgReady, orgUserKey, conversations]);

  const updateOrg = useCallback((updater: (prev: SidebarOrgState) => SidebarOrgState) => {
    setOrg((prev) => updater(prev));
  }, []);

  const handleTogglePin = useCallback((conversationId: string) => {
    updateOrg((prev) => {
      const isPinned = prev.pinnedIds.includes(conversationId);
      return {
        ...prev,
        pinnedIds: isPinned
          ? prev.pinnedIds.filter((id) => id !== conversationId)
          : [conversationId, ...prev.pinnedIds],
      };
    });
  }, [updateOrg]);

  const handleCreateFolder = useCallback(
    (name: string) => {
      updateOrg((prev) => ({
        ...prev,
        folders: [
          {
            id: createFolderId(),
            name,
            createdAt: new Date().toISOString(),
          },
          ...prev.folders,
        ],
      }));
    },
    [updateOrg]
  );

  const handleRenameFolder = useCallback(
    (folderId: string, name: string) => {
      updateOrg((prev) => ({
        ...prev,
        folders: prev.folders.map((folder) =>
          folder.id === folderId ? { ...folder, name } : folder
        ),
      }));
    },
    [updateOrg]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      updateOrg((prev) => {
        const folderByConversationId = { ...prev.folderByConversationId };
        for (const [conversationId, id] of Object.entries(
          folderByConversationId
        )) {
          if (id === folderId) {
            delete folderByConversationId[conversationId];
          }
        }
        return {
          ...prev,
          folders: prev.folders.filter((folder) => folder.id !== folderId),
          folderByConversationId,
        };
      });
    },
    [updateOrg]
  );

  const handleMoveToFolder = useCallback(
    (conversationId: string, folderId: string | null) => {
      updateOrg((prev) => {
        const folderByConversationId = { ...prev.folderByConversationId };
        if (!folderId) {
          delete folderByConversationId[conversationId];
        } else {
          folderByConversationId[conversationId] = folderId;
        }
        return { ...prev, folderByConversationId };
      });
    },
    [updateOrg]
  );

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const root = panelRef.current;
    if (!root) {
      return;
    }

    const getFocusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

    const focusables = getFocusable();
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
        onMobileClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const items = getFocusable();
      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isMobileOpen, isSearchOpen, onMobileClose]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title || "گفتگوی جدید").includes(q)
    );
  }, [conversations, searchQuery]);

  const navGroups = useMemo<NavGroupData[]>(
    () => [
      {
        items: [
          { id: "search", title: "جستجو", icon: Search, shortcut: "⌘K" },
          { id: "home", title: "هاب معاونت‌ها", icon: LayoutDashboard },
          { id: "new-chat", title: "گفتگوی جدید", icon: MessageSquarePlus },
        ],
      },
    ],
    []
  );

  const bottomItems = useMemo<NavItemData[]>(
    () => [
      {
        id: "logout",
        title: "خروج",
        icon: LogOut,
      },
    ],
    []
  );

  const handleSelect = (id: string) => {
    if (id === "search") {
      setIsSearchOpen(true);
      return;
    }
    if (id === "home" || id === "new-chat") {
      onNewChat();
      return;
    }
    if (id === "logout") {
      onLogout?.();
      return;
    }
    onSelectConversation(id);
  };

  return (
    <aside
      ref={panelRef}
      className={[
        styles.sidebar,
        styles.sidebarDashboard,
        isMobileOpen ? styles.sidebarOpen : "",
      ]
        .filter(Boolean)
        .join(" ")}
      id="chat-sidebar"
      aria-labelledby={titleId}
      {...(isMobileOpen
        ? {
            role: "dialog",
            "aria-modal": true,
          }
        : {
            "aria-label": "فهرست گفتگوها",
          })}
    >
      <h2 id={titleId} className={styles.sidebarDialogTitle}>
        فهرست گفتگوها
      </h2>

      <SidebarNav
        className="h-full w-full border-none bg-transparent p-0"
        dir="rtl"
        activeId={activeConversationId}
        onSelect={handleSelect}
        activeWorkspace={workspaceName}
        workspaces={workspaces}
        planLabel={planLabel}
        allowCreateWorkspace={false}
        navGroups={navGroups}
        bottomItems={bottomItems}
        middle={
          <SidebarChatLibrary
            conversations={conversations}
            activeConversationId={activeConversationId}
            folders={org.folders}
            pinnedIds={org.pinnedIds}
            folderByConversationId={org.folderByConversationId}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onTogglePin={handleTogglePin}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveToFolder={handleMoveToFolder}
          />
        }
      />

      {isSearchOpen ? (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/50 px-3 pt-16 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
            }}
            aria-hidden
          />
          <div className="relative w-full animate-in fade-in zoom-in-95 overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl duration-200">
            <div className="flex items-center border-b border-border/50 px-3">
              <Search
                className="me-2 h-4 w-4 shrink-0 text-muted-foreground/70"
                strokeWidth={1.5}
              />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1 bg-transparent py-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
                placeholder="جستجوی گفتگوها…"
                dir="rtl"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="ms-2 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                aria-label="بستن جستجو"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto p-2">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Command
                    className="mb-2 h-5 w-5 text-muted-foreground/30"
                    strokeWidth={1.5}
                  />
                  <p className="text-[12px] font-medium text-muted-foreground">
                    گفتگویی پیدا نشد
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className="rounded-md px-3 py-2 text-right text-[13px] text-foreground/90 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      setIsSearchOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    {conversation.title || "گفتگوی جدید"}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
