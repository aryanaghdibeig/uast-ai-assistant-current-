"use client";

import React, { useState } from "react";
import {
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X,
} from "lucide-react";
import {
  SidebarNav,
  defaultBottomItems,
  defaultNavGroups,
  flattenNavItems,
} from "@/components/ui/dashboard-sidebar";

const flatMockData = flattenNavItems([
  ...defaultNavGroups.flatMap((g) => g.items),
  ...defaultBottomItems,
]);

/** Preview shell for the dashboard sidebar (shadcn demo). */
export default function SidebarNavPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState("home");
  const [activeWorkspace, setActiveWorkspace] = useState("Acme Corp");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeItem = flatMockData.find((i) => i.id === activeId);
  const activeTitle = activeItem ? activeItem.title : "Dashboard";

  const handleSelect = (id: string) => {
    if (id === "search") {
      setIsSearchOpen(true);
      return;
    }
    setActiveId(id);
  };

  return (
    <div className="flex min-h-[700px] w-full flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="relative flex h-[700px] w-full max-w-4xl overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div
          className={`h-full shrink-0 overflow-hidden border-e border-border/50 bg-card/50 transition-all duration-300 ease-in-out ${
            isOpen ? "w-[360px] opacity-100" : "w-0 border-none opacity-0"
          }`}
        >
          <SidebarNav
            className="w-[360px] border-none bg-transparent"
            activeId={activeId}
            onSelect={handleSelect}
            activeWorkspace={activeWorkspace}
            onWorkspaceSelect={setActiveWorkspace}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-black/[0.02] transition-all duration-300 dark:bg-white/[0.02]">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-card px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
              >
                {isOpen ? (
                  <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
                ) : (
                  <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
                )}
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{activeWorkspace}</span>
                <span>/</span>
                <span className="truncate font-medium text-foreground">
                  {activeTitle}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden h-8 w-64 rounded-md bg-black/5 md:block dark:bg-white/5" />
              <div className="h-8 w-8 rounded-full border border-primary/20 bg-primary/10" />
            </div>
          </div>

          <div className="overflow-y-auto p-6 [-ms-overflow-style:none] [scrollbar-width:none] md:p-8 [&::-webkit-scrollbar]:hidden">
            <div className="mb-8 flex items-center justify-between">
              <div className="h-8 w-48 rounded-md bg-black/5 dark:bg-white/5" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="h-32 rounded-xl border border-border/50 bg-card shadow-sm" />
              <div className="h-32 rounded-xl border border-border/50 bg-card shadow-sm" />
            </div>

            <div className="w-full rounded-xl border border-border/50 bg-card p-6 shadow-sm">
              <div className="mb-6 h-5 w-1/3 rounded-md bg-black/5 dark:bg-white/5" />
              <div className="mb-6 h-px w-full bg-border/50" />
              <div className="flex flex-col gap-4">
                <div className="h-12 w-full rounded-lg bg-black/5 dark:bg-white/5" />
                <div className="h-12 w-full rounded-lg bg-black/5 dark:bg-white/5" />
                <div className="h-12 w-full rounded-lg bg-black/5 dark:bg-white/5" />
                <div className="h-12 w-full rounded-lg bg-black/5 dark:bg-white/5" />
              </div>
            </div>
          </div>
        </div>

        {isSearchOpen ? (
          <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/40 px-4 pt-[15vh] backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={() => setIsSearchOpen(false)}
              aria-hidden
            />
            <div className="relative w-full max-w-xl animate-in fade-in zoom-in-95 overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl duration-200">
              <div className="flex items-center border-b border-border/50 px-4">
                <Search
                  className="me-3 h-[18px] w-[18px] shrink-0 text-muted-foreground/70"
                  strokeWidth={1.5}
                />
                <input
                  autoFocus
                  className="flex-1 bg-transparent py-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/50"
                  placeholder="Search projects, docs, or actions..."
                />
                <kbd
                  onClick={() => setIsSearchOpen(false)}
                  className="ms-2 hidden h-5 cursor-pointer items-center justify-center rounded-[4px] border border-black/10 bg-black/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-black/10 hover:text-foreground sm:inline-flex dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  ESC
                </kbd>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="ms-3 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center p-2 py-8">
                <Command
                  className="mb-2 h-6 w-6 text-muted-foreground/30"
                  strokeWidth={1.5}
                />
                <p className="text-[13px] font-medium text-muted-foreground">
                  Type a command or search...
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
