// lib/chat/sidebar-org.ts
// Client-side pin + folder organization for the chat sidebar.
// Persisted per user in localStorage (no DB migrate required).

export type SidebarFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type SidebarOrgState = {
  folders: SidebarFolder[];
  pinnedIds: string[];
  /** conversationId → folderId */
  folderByConversationId: Record<string, string>;
};

export const EMPTY_SIDEBAR_ORG: SidebarOrgState = {
  folders: [],
  pinnedIds: [],
  folderByConversationId: {},
};

function storageKey(userKey: string) {
  return `uast-sidebar-org:v1:${userKey || "anonymous"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadSidebarOrg(userKey: string): SidebarOrgState {
  if (typeof window === "undefined") {
    return EMPTY_SIDEBAR_ORG;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return EMPTY_SIDEBAR_ORG;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_SIDEBAR_ORG;

    const folders = Array.isArray(parsed.folders)
      ? parsed.folders
          .filter(isRecord)
          .map((folder) => ({
            id: String(folder.id ?? ""),
            name: String(folder.name ?? "").trim() || "پوشه",
            createdAt:
              typeof folder.createdAt === "string"
                ? folder.createdAt
                : new Date().toISOString(),
          }))
          .filter((folder) => folder.id)
      : [];

    const pinnedIds = Array.isArray(parsed.pinnedIds)
      ? parsed.pinnedIds.map(String).filter(Boolean)
      : [];

    const folderByConversationId: Record<string, string> = {};
    if (isRecord(parsed.folderByConversationId)) {
      for (const [conversationId, folderId] of Object.entries(
        parsed.folderByConversationId
      )) {
        if (typeof folderId === "string" && folderId) {
          folderByConversationId[conversationId] = folderId;
        }
      }
    }

    return { folders, pinnedIds, folderByConversationId };
  } catch {
    return EMPTY_SIDEBAR_ORG;
  }
}

export function saveSidebarOrg(userKey: string, state: SidebarOrgState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function createFolderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Drop refs to conversations that no longer exist. */
export function pruneSidebarOrg(
  state: SidebarOrgState,
  conversationIds: Set<string>
): SidebarOrgState {
  const pinnedIds = state.pinnedIds.filter((id) => conversationIds.has(id));
  const folderByConversationId: Record<string, string> = {};
  const folderIds = new Set(state.folders.map((f) => f.id));

  for (const [conversationId, folderId] of Object.entries(
    state.folderByConversationId
  )) {
    if (conversationIds.has(conversationId) && folderIds.has(folderId)) {
      folderByConversationId[conversationId] = folderId;
    }
  }

  return {
    folders: state.folders,
    pinnedIds,
    folderByConversationId,
  };
}
