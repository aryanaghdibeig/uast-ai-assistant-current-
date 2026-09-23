"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Folder,
  FolderPlus,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrgLabelForMode } from "@/lib/org/deputies";
import type { AssistantModeId } from "@/types/chat";
import type { SidebarFolder } from "@/lib/chat/sidebar-org";

export type LibraryConversation = {
  id: string;
  title: string;
  messagesCount: number;
  assistantMode?: AssistantModeId;
};

type SidebarChatLibraryProps = {
  conversations: LibraryConversation[];
  activeConversationId: string;
  folders: SidebarFolder[];
  pinnedIds: string[];
  folderByConversationId: Record<string, string>;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveToFolder: (conversationId: string, folderId: string | null) => void;
};

const LIST_PREVIEW = 5;

function getMessagesLabel(count: number) {
  if (count === 0) return null;
  return count.toLocaleString("fa-IR");
}

function ShowMoreToggle({
  expanded,
  hiddenCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  if (hiddenCount <= 0 && !expanded) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
    >
      {expanded ? (
        <>
          <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
          کمتر
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
          بیشتر
          <span className="text-[12px] font-medium text-primary">
            ({hiddenCount.toLocaleString("fa-IR")})
          </span>
        </>
      )}
    </button>
  );
}

function ConversationRow({
  conversation,
  isActive,
  isPinned,
  folders,
  currentFolderId,
  onSelect,
  onDelete,
  onTogglePin,
  onMoveToFolder,
}: {
  conversation: LibraryConversation;
  isActive: boolean;
  isPinned: boolean;
  folders: SidebarFolder[];
  currentFolderId?: string;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMoveToFolder: (folderId: string | null) => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const modeInfo = getOrgLabelForMode(conversation.assistantMode ?? "general");
  const badge = getMessagesLabel(conversation.messagesCount) ?? modeInfo.icon;

  useEffect(() => {
    if (!moveOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMoveOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moveOpen]);

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2.5 transition-all duration-200",
        isActive
          ? "bg-black/5 font-semibold text-foreground dark:bg-white/10"
          : "text-foreground/80 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
      )}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <MessageSquare
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            isActive
              ? "text-foreground"
              : "text-muted-foreground/70 group-hover:text-foreground/70"
          )}
          strokeWidth={1.5}
        />
        <span className="truncate text-[15px] leading-6 tracking-wide">
          {conversation.title || "گفتگوی جدید"}
        </span>
      </div>

      <div className="relative flex shrink-0 items-center gap-1">
        {isPinned ? (
          <Pin
            className="h-3.5 w-3.5 text-primary opacity-80"
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
        {badge != null ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[12px] font-medium text-primary">
            {badge}
          </span>
        ) : null}

        <button
          type="button"
          className={cn(
            "rounded p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10",
            isPinned
              ? "inline-flex text-primary"
              : "hidden text-muted-foreground/60 group-hover:inline-flex"
          )}
          title={isPinned ? "برداشتن سنجاق" : "سنجاق کردن"}
          aria-label={isPinned ? "برداشتن سنجاق" : "سنجاق کردن"}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
        >
          {isPinned ? (
            <PinOff className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Pin className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          className="hidden rounded p-1 text-muted-foreground/60 transition-colors hover:bg-black/10 hover:text-foreground group-hover:inline-flex dark:hover:bg-white/10"
          title="انتقال به پوشه"
          aria-label="انتقال به پوشه"
          onClick={(event) => {
            event.stopPropagation();
            setMoveOpen((open) => !open);
          }}
        >
          <Folder className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className="hidden rounded p-1 text-muted-foreground/60 transition-colors hover:bg-black/10 hover:text-foreground group-hover:inline-flex dark:hover:bg-white/10"
          title="حذف گفتگو"
          aria-label="حذف گفتگو"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {moveOpen ? (
          <div
            ref={menuRef}
            className="absolute top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border/50 bg-card py-1 shadow-xl inset-inline-end-0"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={cn(
                "block w-full px-3 py-2 text-right text-[13px] transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                !currentFolderId
                  ? "font-medium text-primary"
                  : "text-foreground/80"
              )}
              onClick={() => {
                onMoveToFolder(null);
                setMoveOpen(false);
              }}
            >
              بدون پوشه
            </button>
            {folders.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-muted-foreground">
                ابتدا یک پوشه بسازید
              </p>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={cn(
                    "block w-full px-3 py-2 text-right text-[13px] transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                    currentFolderId === folder.id
                      ? "font-medium text-primary"
                      : "text-foreground/80"
                  )}
                  onClick={() => {
                    onMoveToFolder(folder.id);
                    setMoveOpen(false);
                  }}
                >
                  {folder.name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FolderBlock({
  folder,
  chats,
  activeConversationId,
  pinnedIds,
  folders,
  folderByConversationId,
  onSelectConversation,
  onDeleteConversation,
  onTogglePin,
  onMoveToFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: SidebarFolder;
  chats: LibraryConversation[];
  activeConversationId: string;
  pinnedIds: string[];
  folders: SidebarFolder[];
  folderByConversationId: Record<string, string>;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onMoveToFolder: (conversationId: string, folderId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(folder.name);
  const [showAllChats, setShowAllChats] = useState(false);

  const visibleChats = showAllChats ? chats : chats.slice(0, LIST_PREVIEW);
  const hiddenChatCount = Math.max(0, chats.length - LIST_PREVIEW);

  return (
    <div className="flex flex-col">
      <div
        className="group flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2.5 text-foreground/85 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((open) => !open);
          }
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Folder
            className="h-[18px] w-[18px] shrink-0 text-muted-foreground/70"
            strokeWidth={1.5}
          />
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => {
                const next = nameDraft.trim();
                if (next && next !== folder.name) {
                  onRenameFolder(folder.id, next);
                } else {
                  setNameDraft(folder.name);
                }
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  (event.target as HTMLInputElement).blur();
                }
                if (event.key === "Escape") {
                  setNameDraft(folder.name);
                  setRenaming(false);
                }
              }}
              className="w-full min-w-0 rounded border border-border/60 bg-background px-1.5 py-1 text-[15px] text-foreground outline-none"
              dir="rtl"
            />
          ) : (
            <span className="truncate text-[15px] font-semibold leading-6 tracking-wide">
              {folder.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[12px] font-medium text-primary">
            {chats.length.toLocaleString("fa-IR")}
          </span>
          <button
            type="button"
            className="hidden rounded p-1 text-muted-foreground/60 group-hover:inline-flex hover:bg-black/10 dark:hover:bg-white/10"
            title="تغییر نام پوشه"
            aria-label="تغییر نام پوشه"
            onClick={(event) => {
              event.stopPropagation();
              setRenaming(true);
            }}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="hidden rounded p-1 text-muted-foreground/60 group-hover:inline-flex hover:bg-black/10 dark:hover:bg-white/10"
            title="حذف پوشه"
            aria-label="حذف پوشه"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteFolder(folder.id);
            }}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <ChevronLeft
            className={cn(
              "h-4 w-4 text-muted-foreground/50 transition-transform duration-200",
              isOpen ? "-rotate-90" : ""
            )}
            strokeWidth={2}
          />
        </div>
      </div>

      {isOpen ? (
        <div className="relative ms-3 mt-0.5 flex flex-col gap-0.5 border-s border-black/5 ps-1 dark:border-white/5">
          {chats.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] leading-6 text-muted-foreground">
              این پوشه خالی است — از آیکون پوشه روی گفتگو استفاده کنید
            </p>
          ) : (
            <>
              {visibleChats.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  isPinned={pinnedIds.includes(conversation.id)}
                  folders={folders}
                  currentFolderId={folderByConversationId[conversation.id]}
                  onSelect={() => onSelectConversation(conversation.id)}
                  onDelete={() => onDeleteConversation(conversation.id)}
                  onTogglePin={() => onTogglePin(conversation.id)}
                  onMoveToFolder={(folderId) =>
                    onMoveToFolder(conversation.id, folderId)
                  }
                />
              ))}
              {chats.length > LIST_PREVIEW ? (
                <ShowMoreToggle
                  expanded={showAllChats}
                  hiddenCount={hiddenChatCount}
                  onToggle={() => setShowAllChats((v) => !v)}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function SidebarChatLibrary({
  conversations,
  activeConversationId,
  folders,
  pinnedIds,
  folderByConversationId,
  onSelectConversation,
  onDeleteConversation,
  onTogglePin,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
}: SidebarChatLibraryProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [showAllPinned, setShowAllPinned] = useState(false);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, LibraryConversation>();
    for (const conversation of conversations) {
      map.set(conversation.id, conversation);
    }
    return map;
  }, [conversations]);

  const pinnedChats = useMemo(
    () =>
      pinnedIds
        .map((id) => byId.get(id))
        .filter((item): item is LibraryConversation => Boolean(item)),
    [byId, pinnedIds]
  );

  const folderChats = useMemo(() => {
    const map = new Map<string, LibraryConversation[]>();
    for (const folder of folders) {
      map.set(folder.id, []);
    }
    for (const conversation of conversations) {
      const folderId = folderByConversationId[conversation.id];
      if (!folderId) continue;
      const list = map.get(folderId);
      if (list) list.push(conversation);
    }
    return map;
  }, [conversations, folderByConversationId, folders]);

  const unfiledChats = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          !folderByConversationId[conversation.id] &&
          !pinnedIds.includes(conversation.id)
      ),
    [conversations, folderByConversationId, pinnedIds]
  );

  const visiblePinned = showAllPinned
    ? pinnedChats
    : pinnedChats.slice(0, LIST_PREVIEW);
  const visibleFolders = showAllFolders
    ? folders
    : folders.slice(0, LIST_PREVIEW);
  const visibleRecent = showAllRecent
    ? unfiledChats
    : unfiledChats.slice(0, LIST_PREVIEW);

  const submitFolder = () => {
    const name = folderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setFolderName("");
      return;
    }
    onCreateFolder(name);
    setFolderName("");
    setCreatingFolder(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {pinnedChats.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className="mb-1.5 px-2.5 text-[13px] font-semibold tracking-wide text-muted-foreground/70">
            سنجاق‌شده
          </span>
          {visiblePinned.map((conversation) => (
            <ConversationRow
              key={`pin-${conversation.id}`}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              isPinned
              folders={folders}
              currentFolderId={folderByConversationId[conversation.id]}
              onSelect={() => onSelectConversation(conversation.id)}
              onDelete={() => onDeleteConversation(conversation.id)}
              onTogglePin={() => onTogglePin(conversation.id)}
              onMoveToFolder={(folderId) =>
                onMoveToFolder(conversation.id, folderId)
              }
            />
          ))}
          {pinnedChats.length > LIST_PREVIEW ? (
            <ShowMoreToggle
              expanded={showAllPinned}
              hiddenCount={pinnedChats.length - LIST_PREVIEW}
              onToggle={() => setShowAllPinned((v) => !v)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-0.5">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="text-[13px] font-semibold tracking-wide text-muted-foreground/70">
            پوشه‌ها
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            onClick={() => setCreatingFolder(true)}
          >
            <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
            پوشه جدید
          </button>
        </div>

        {creatingFolder ? (
          <div className="mb-1 flex items-center gap-1.5 px-1.5">
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitFolder();
                if (event.key === "Escape") {
                  setCreatingFolder(false);
                  setFolderName("");
                }
              }}
              placeholder="نام پوشه…"
              className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2.5 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50"
              dir="rtl"
            />
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
              onClick={submitFolder}
            >
              ساخت
            </button>
          </div>
        ) : null}

        {folders.length === 0 && !creatingFolder ? (
          <p className="px-2.5 py-1.5 text-[13px] leading-7 text-muted-foreground">
            پوشه‌ای نیست. برای دسته‌بندی گفتگوها «پوشه جدید» را بزنید.
          </p>
        ) : (
          <>
            {visibleFolders.map((folder) => (
              <FolderBlock
                key={folder.id}
                folder={folder}
                chats={folderChats.get(folder.id) ?? []}
                activeConversationId={activeConversationId}
                pinnedIds={pinnedIds}
                folders={folders}
                folderByConversationId={folderByConversationId}
                onSelectConversation={onSelectConversation}
                onDeleteConversation={onDeleteConversation}
                onTogglePin={onTogglePin}
                onMoveToFolder={onMoveToFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ))}
            {folders.length > LIST_PREVIEW ? (
              <ShowMoreToggle
                expanded={showAllFolders}
                hiddenCount={folders.length - LIST_PREVIEW}
                onToggle={() => setShowAllFolders((v) => !v)}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="mb-1.5 px-2.5 text-[13px] font-semibold tracking-wide text-muted-foreground/70">
          گفتگوهای اخیر
        </span>
        {unfiledChats.length === 0 ? (
          <p className="px-2.5 py-2 text-[13px] leading-7 text-muted-foreground">
            {conversations.length === 0
              ? "هنوز گفتگویی ساخته نشده است."
              : "همه گفتگوها داخل پوشه هستند."}
          </p>
        ) : (
          <>
            {visibleRecent.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                isPinned={pinnedIds.includes(conversation.id)}
                folders={folders}
                currentFolderId={folderByConversationId[conversation.id]}
                onSelect={() => onSelectConversation(conversation.id)}
                onDelete={() => onDeleteConversation(conversation.id)}
                onTogglePin={() => onTogglePin(conversation.id)}
                onMoveToFolder={(folderId) =>
                  onMoveToFolder(conversation.id, folderId)
                }
              />
            ))}
            {unfiledChats.length > LIST_PREVIEW ? (
              <ShowMoreToggle
                expanded={showAllRecent}
                hiddenCount={unfiledChats.length - LIST_PREVIEW}
                onToggle={() => setShowAllRecent((v) => !v)}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
