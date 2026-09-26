"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardItem {
  id: string | number;
  title: string;
  description: string;
  imgSrc: string;
  icon: React.ReactNode;
  linkHref: string;
}

interface ExpandingCardsProps extends React.HTMLAttributes<HTMLUListElement> {
  items: CardItem[];
  /** پیش‌فرض: هیچ کارتی باز نباشد */
  defaultActiveIndex?: number | null;
  activeIndex?: number | null;
  onActiveIndexChange?: (index: number) => void;
  onItemSelect?: (item: CardItem, index: number) => void;
}

export const ExpandingCards = React.forwardRef<
  HTMLUListElement,
  ExpandingCardsProps
>(
  (
    {
      className,
      items,
      defaultActiveIndex = null,
      activeIndex: controlledIndex,
      onActiveIndexChange,
      onItemSelect,
      ...props
    },
    ref
  ) => {
    const [uncontrolledIndex, setUncontrolledIndex] = React.useState<
      number | null
    >(defaultActiveIndex);
    const [isDesktop, setIsDesktop] = React.useState(false);
    const [canHover, setCanHover] = React.useState(false);

    const isControlled = controlledIndex !== undefined;
    const activeIndex = isControlled ? controlledIndex : uncontrolledIndex;
    const noneActive = activeIndex === null;

    React.useEffect(() => {
      const mqDesktop = window.matchMedia("(min-width: 768px)");
      const mqHover = window.matchMedia("(hover: hover) and (pointer: fine)");

      const sync = () => {
        setIsDesktop(mqDesktop.matches);
        setCanHover(mqHover.matches);
      };

      sync();
      mqDesktop.addEventListener("change", sync);
      mqHover.addEventListener("change", sync);
      return () => {
        mqDesktop.removeEventListener("change", sync);
        mqHover.removeEventListener("change", sync);
      };
    }, []);

    const setActive = React.useCallback(
      (index: number) => {
        if (!isControlled) {
          setUncontrolledIndex(index);
        }
        onActiveIndexChange?.(index);
      },
      [isControlled, onActiveIndexChange]
    );

    const gridStyle = React.useMemo(() => {
      if (isDesktop) {
        if (noneActive) {
          return {
            gridTemplateColumns: items.map(() => "1fr").join(" "),
          };
        }
        const columns = items
          .map((_, index) => (index === activeIndex ? "4.5fr" : "1fr"))
          .join(" ");
        return { gridTemplateColumns: columns };
      }

      if (noneActive) {
        return {
          gridTemplateRows: items.map(() => "minmax(64px, 1fr)").join(" "),
        };
      }

      const rows = items
        .map((_, index) =>
          index === activeIndex ? "minmax(168px, 38vh)" : "52px"
        )
        .join(" ");
      return { gridTemplateRows: rows };
    }, [activeIndex, items, isDesktop, noneActive]);

    const handleHover = (index: number) => {
      if (!canHover) return;
      setActive(index);
    };

    const handleSelect = (index: number) => {
      setActive(index);
      onItemSelect?.(items[index], index);
    };

    return (
      <ul
        dir="rtl"
        className={cn(
          "font-[family-name:var(--font-sans)] w-full max-w-5xl gap-2",
          "grid",
          noneActive
            ? "h-[min(420px,52vh)] md:h-[min(520px,58vh)]"
            : "h-auto md:h-[min(520px,58vh)]",
          "transition-[grid-template-columns,grid-template-rows] duration-500 ease-out",
          className
        )}
        style={{
          ...gridStyle,
          ...(isDesktop
            ? { gridTemplateRows: "1fr" }
            : { gridTemplateColumns: "1fr" }),
        }}
        ref={ref}
        {...props}
      >
        {items.map((item, index) => {
          const isActive = activeIndex === index;
          return (
            <li
              key={item.id}
              className={cn(
                "group relative min-h-0 min-w-0 cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm",
                "touch-manipulation",
                "md:min-w-[64px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              )}
              onMouseEnter={() => handleHover(index)}
              onFocus={() => handleHover(index)}
              onClick={() => handleSelect(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(index);
                }
              }}
              tabIndex={0}
              data-active={isActive}
              aria-current={isActive ? "true" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imgSrc}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full object-cover object-center transition-all duration-300 ease-out",
                  "scale-105",
                  "group-data-[active=true]:scale-100"
                )}
              />
              <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

              <article className="absolute inset-0 z-[2] flex flex-col justify-end gap-1.5 overflow-hidden p-3 pb-4 text-right md:gap-2 md:p-5 md:pb-5">
                {/* نام در حالت غیرفعال / اولیه — خاکستری و خوانا */}
                <h3
                  className={cn(
                    "font-[family-name:var(--font-sans)] transition-all duration-300 ease-out",
                    isActive && "pointer-events-none opacity-0",
                    !isActive && "opacity-100",
                    noneActive
                      ? "text-[15px] font-extrabold leading-snug text-white/55 md:text-lg"
                      : cn(
                          "text-sm font-bold text-white/60",
                          "md:absolute md:bottom-5 md:right-3 md:origin-right md:-rotate-90 md:whitespace-nowrap md:text-base md:font-extrabold"
                        )
                  )}
                >
                  {item.title}
                </h3>

                <div
                  className={cn(
                    "flex min-h-0 flex-col gap-1.5 transition-all duration-300 ease-out md:gap-2",
                    isActive
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-2 opacity-0"
                  )}
                >
                  <div className="shrink-0 text-white/95">{item.icon}</div>

                  <h3 className="shrink-0 font-[family-name:var(--font-sans)] text-base font-extrabold leading-snug text-white md:text-xl">
                    {item.title}
                  </h3>

                  <p className="max-w-full whitespace-normal break-words text-[13px] font-medium leading-7 text-white/95 md:max-w-[26rem] md:text-sm md:leading-8">
                    {item.description}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    );
  }
);
ExpandingCards.displayName = "ExpandingCards";
