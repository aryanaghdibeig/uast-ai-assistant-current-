"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  size: number;
  color: string;
};

type AetherFlowHeroProps = {
  children?: React.ReactNode;
  className?: string;
  fullViewport?: boolean;
  density?: "normal" | "high";
  /** Force palette from parent (keeps sync with ThemeToggle). */
  mode?: "light" | "dark";
};

/**
 * Interactive particle field (Aether Flow) — theme-aware, denser network.
 */
export default function AetherFlowHero({
  children,
  className,
  fullViewport = true,
  density = "high",
  mode,
}: AetherFlowHeroProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const modeRef = React.useRef(mode);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let particles: Particle[] = [];
    const mouse = { x: null as number | null, y: null as number | null, radius: 200 };

    const resolveDark = () => {
      if (modeRef.current === "dark") return true;
      if (modeRef.current === "light") return false;
      return document.documentElement.getAttribute("data-theme") === "dark";
    };

    let isDark = resolveDark();

    const palette = () =>
      isDark
        ? {
            bg: "#050d18",
            a: "rgba(45, 212, 191, 0.8)",
            b: "rgba(125, 211, 252, 0.7)",
            line: "rgba(94, 234, 212, 0.5)",
            lineHot: "rgba(255, 255, 255, 0.85)",
          }
        : {
            bg: "#e8eef6",
            a: "rgba(13, 148, 136, 0.55)",
            b: "rgba(29, 78, 216, 0.4)",
            line: "rgba(15, 118, 110, 0.35)",
            lineHot: "rgba(15, 23, 42, 0.45)",
          };

    const createParticle = (
      x: number,
      y: number,
      directionX: number,
      directionY: number,
      size: number,
      color: string
    ): Particle => ({ x, y, directionX, directionY, size, color });

    const drawParticle = (p: Particle) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2, false);
      ctx.fillStyle = p.color;
      ctx.fill();
    };

    const updateParticle = (p: Particle) => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (p.x > cssW || p.x < 0) p.directionX = -p.directionX;
      if (p.y > cssH || p.y < 0) p.directionY = -p.directionY;

      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < mouse.radius + p.size) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (mouse.radius - distance) / mouse.radius;
          p.x -= forceDirectionX * force * 4;
          p.y -= forceDirectionY * force * 4;
        }
      }

      p.x += p.directionX;
      p.y += p.directionY;
      drawParticle(p);
    };

    const init = () => {
      const colors = palette();
      particles = [];
      const area = canvas.clientWidth * canvas.clientHeight;
      // خیلی متراکم‌تر از قبل
      const divisor = density === "high" ? 2200 : 9000;
      const numberOfParticles = Math.min(
        density === "high" ? 340 : 140,
        Math.max(density === "high" ? 140 : 50, Math.floor(area / divisor))
      );
      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2.2 + 0.55;
        const x = Math.random() * canvas.clientWidth;
        const y = Math.random() * canvas.clientHeight;
        const directionX = Math.random() * 0.45 - 0.225;
        const directionY = Math.random() * 0.45 - 0.225;
        const color = Math.random() > 0.42 ? colors.a : colors.b;
        particles.push(createParticle(x, y, directionX, directionY, size, color));
      }
    };

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    };

    const connect = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const linkRange = Math.min(w, h) * 0.28;
      const maxDist = linkRange * linkRange;

      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = dx * dx + dy * dy;

          if (distance < maxDist) {
            const opacityValue = 1 - distance / (maxDist * 1.15);
            let nearMouse = false;
            if (mouse.x !== null && mouse.y !== null) {
              const mdx = particles[a].x - mouse.x;
              const mdy = particles[a].y - mouse.y;
              nearMouse = Math.sqrt(mdx * mdx + mdy * mdy) < mouse.radius;
            }

            ctx.strokeStyle = nearMouse
              ? `rgba(${isDark ? "255, 255, 255" : "15, 23, 42"}, ${opacityValue * 0.7})`
              : `rgba(${isDark ? "94, 234, 212" : "15, 118, 110"}, ${opacityValue * 0.38})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const nextDark = resolveDark();
      if (nextDark !== isDark) {
        isDark = nextDark;
        init();
      }
      const colors = palette();
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      for (let i = 0; i < particles.length; i++) {
        updateParticle(particles[i]);
      }
      connect();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const handleTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const rect = container.getBoundingClientRect();
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
    };

    const themeObserver = new MutationObserver(() => {
      const next = resolveDark();
      if (next === isDark) return;
      isDark = next;
      init();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("resize", resizeCanvas);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseOut);
    container.addEventListener("touchmove", handleTouch, { passive: true });

    resizeCanvas();
    animate();

    return () => {
      themeObserver.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseOut);
      container.removeEventListener("touchmove", handleTouch);
      cancelAnimationFrame(animationFrameId);
    };
  }, [density]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full flex-col overflow-hidden",
        "bg-[var(--bg,#050d18)]",
        fullViewport && "min-h-screen min-h-[100dvh]",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
      <div className="relative z-10 flex h-full min-h-[100dvh] w-full flex-col">
        {children}
      </div>
    </div>
  );
}
