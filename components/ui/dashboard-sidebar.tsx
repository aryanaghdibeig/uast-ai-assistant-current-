"use client";

import React, { useState } from "react";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Hash,
  ChevronDown,
  ChevronLeft,
  Inbox,
  Calendar,
  Activity,
  CreditCard,
  Globe,
  Terminal,
  Blocks,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
  /** Optional trailing action (e.g. delete conversation) */
  action?: {
    icon: React.ElementType;
    label: string;
    onClick: (event: React.MouseEvent) => void;
  };
  /** Multiple trailing actions (preferred over single action) */
  actions?: Array<{
    icon: React.ElementType;
    label: string;
    onClick: (event: React.MouseEvent) => void;
    active?: boolean;
  }>;
  /** Start expandable groups open */
  defaultOpen?: boolean;
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

export const defaultNavGroups: NavGroupData[] = [
  {
    items: [
      { id: "search", title: "Search", icon: Search, shortcut: "⌘K" },
      { id: "home", title: "Home", icon: LayoutDashboard },
      { id: "inbox", title: "Inbox", icon: Inbox, badge: 12 },
      { id: "analytics", title: "Analytics", icon: Activity },
    ],
  },
  {
    heading: "Workspace",
    items: [
      {
        id: "projects",
        title: "Projects",
        icon: FolderKanban,
        children: [
          { id: "p-active", title: "Active", icon: Hash },
          { id: "p-archived", title: "Archived", icon: Hash },
        ],
      },
      { id: "calendar", title: "Calendar", icon: Calendar },
      {
        id: "team",
        title: "Team",
        icon: Users,
        children: [
          { id: "t-design", title: "Designers", icon: Hash },
          { id: "t-eng", title: "Engineering", icon: Hash },
          { id: "t-product", title: "Product", icon: Hash },
        ],
      },
      {
        id: "customers",
        title: "Customers",
        icon: Globe,
        children: [
          { id: "c-enterprise", title: "Enterprise", icon: Hash },
          { id: "c-smb", title: "SMB", icon: Hash },
        ],
      },
      { id: "finance", title: "Finance", icon: CreditCard },
    ],
  },
  {
    heading: "Developers",
    items: [
      { id: "api", title: "API Keys", icon: Terminal },
      { id: "webhooks", title: "Webhooks", icon: Blocks },
    ],
  },
];

export const defaultBottomItems: NavItemData[] = [
  { id: "settings", title: "Settings", icon: Settings, shortcut: "⌘," },
  { id: "logout", title: "Log out", icon: LogOut },
];

const defaultWorkspaces = [
  "Acme Corp",
  "Personal Workspace",
  "Client Sandbox",
];

function WorkspaceSwitcher({
  selected,
  onSelect,
  workspaces = defaultWorkspaces,
  planLabel = "Pro Plan",
  allowCreate = true,
  createLabel = "Create Workspace",
}: {
  selected?: string;
  onSelect?: (ws: string) => void;
  workspaces?: string[];
  planLabel?: string;
  allowCreate?: boolean;
  createLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState(
    workspaces[0] ?? "Workspace"
  );

  const current = selected || internalSelected;
  const handleSelect = onSelect || setInternalSelected;

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="mb-4 flex cursor-pointer select-none items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-black/5 group dark:hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary text-[13px] font-semibold text-primary-foreground shadow-sm">
            {current.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="mb-1 max-w-[200px] truncate text-[15px] font-semibold leading-none text-foreground">
              {current}
            </span>
            <span className="text-[12px] leading-none text-muted-foreground">
              {planLabel}
            </span>
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70"
          strokeWidth={1.5}
        />
      </div>

      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-inline-start-0 top-[52px] z-50 flex w-full animate-in fade-in zoom-in-95 flex-col gap-0.5 rounded-lg border border-border/50 bg-card py-1 shadow-xl duration-100">
            {workspaces.map((ws) => (
              <div
                key={ws}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleSelect(ws);
                  setIsOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(ws);
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "mx-1 cursor-pointer rounded-md px-3 py-2 text-[13px] transition-colors",
                  current === ws
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                {ws}
              </div>
            ))}
            {allowCreate ? (
              <>
                <div className="mx-2 my-1 h-px bg-border/50" />
                <div className="mx-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <span className="mb-0.5 text-[16px] leading-none">+</span>{" "}
                  {createLabel}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function NavItem({
  item,
  activeId,
  onSelect,
  level = 0,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (id: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(Boolean(item.defaultOpen));
  const trailingActions =
    item.actions ??
    (item.action
      ? [
          {
            icon: item.action.icon,
            label: item.action.label,
            onClick: item.action.onClick,
          },
        ]
      : []);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.id);
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-2.5 transition-all duration-200",
          isActive
            ? "bg-black/5 font-semibold text-foreground dark:bg-white/10"
            : "text-foreground/80 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
        )}
        style={{ paddingInlineStart: `${level * 12 + 10}px` }}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <item.icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground/70 group-hover:text-foreground/70"
            )}
            strokeWidth={1.5}
          />
          <span className="truncate text-[15px] leading-6 tracking-wide">
            {item.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.shortcut ? (
            <kbd className="hidden h-5 items-center justify-center rounded-[4px] border border-border/50 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60 shadow-xs group-hover:inline-flex">
              {item.shortcut}
            </kbd>
          ) : null}
          {item.badge != null ? (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[12px] font-medium text-primary">
              {item.badge}
            </span>
          ) : null}
          {trailingActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className={cn(
                  "rounded p-0.5 transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10",
                  action.active
                    ? "inline-flex text-primary"
                    : "hidden text-muted-foreground/60 group-hover:inline-flex"
                )}
                aria-label={action.label}
                title={action.label}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick(event);
                }}
              >
                <ActionIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            );
          })}
          {hasChildren ? (
            <ChevronLeft
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
                isOpen ? "-rotate-90" : ""
              )}
              strokeWidth={2}
            />
          ) : null}
        </div>
      </div>

      {hasChildren ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            isOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute inset-y-0 border-s border-black/5 dark:border-white/5"
              style={{ insetInlineStart: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type SidebarNavProps = {
  className?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
  activeWorkspace?: string;
  onWorkspaceSelect?: (ws: string) => void;
  workspaces?: string[];
  planLabel?: string;
  allowCreateWorkspace?: boolean;
  createWorkspaceLabel?: string;
  navGroups?: NavGroupData[];
  bottomItems?: NavItemData[];
  /** Custom content below nav groups (e.g. chat library) */
  middle?: React.ReactNode;
  dir?: "rtl" | "ltr";
};

export function SidebarNav({
  className = "",
  activeId,
  onSelect,
  activeWorkspace,
  onWorkspaceSelect,
  workspaces,
  planLabel,
  allowCreateWorkspace = true,
  createWorkspaceLabel,
  navGroups = defaultNavGroups,
  bottomItems = defaultBottomItems,
  middle,
  dir = "ltr",
}: SidebarNavProps) {
  const [internalId, setInternalId] = useState("home");
  const currentId = activeId !== undefined ? activeId : internalId;
  const handleSelect = onSelect || setInternalId;

  return (
    <div
      dir={dir}
      className={cn(
        "flex h-full w-full min-w-[320px] flex-col border-e border-border/50 bg-card/50 p-3 font-sans",
        className
      )}
    >
      <WorkspaceSwitcher
        selected={activeWorkspace}
        onSelect={onWorkspaceSelect}
        workspaces={workspaces}
        planLabel={planLabel}
        allowCreate={allowCreateWorkspace}
        createLabel={createWorkspaceLabel}
      />

      <div className="mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading ? (
              <span className="mb-1.5 px-2.5 text-[13px] font-semibold tracking-wide text-muted-foreground/70">
                {group.heading}
              </span>
            ) : null}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                activeId={currentId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ))}
        {middle}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4">
        {bottomItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            activeId={currentId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function flattenNavItems(items: NavItemData[]): NavItemData[] {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flattenNavItems(item.children));
    return acc;
  }, [] as NavItemData[]);
}
