"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import type { Container, Engine, ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { cn } from "@/lib/utils";
import { motion, useAnimation } from "framer-motion";

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  particleSize?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
  /** Dashboard backgrounds should stay non-interactive. */
  interactive?: boolean;
};

/** Must stay referentially stable for ParticlesProvider. */
async function registerSlimPlugins(engine: Engine) {
  await loadSlim(engine);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const SparklesCore = (props: ParticlesProps) => {
  const {
    id,
    className,
    background = "transparent",
    minSize = 0.5,
    maxSize = 1.4,
    speed = 1.2,
    particleColor = "#ffffff",
    particleDensity = 90,
    interactive = false,
  } = props;

  const controls = useAnimation();
  const generatedId = useId();
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    setMotionOk(!prefersReducedMotion());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMotionOk(!media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const particlesLoaded = useCallback(
    async (container?: Container) => {
      if (!container) {
        return;
      }
      await controls.start({
        opacity: 1,
        transition: { duration: 1 },
      });
    },
    [controls],
  );

  const options = useMemo<ISourceOptions>(
    () => ({
      background: {
        color: {
          value: background,
        },
      },
      fullScreen: {
        enable: false,
        zIndex: 0,
      },
      fpsLimit: 60,
      detectRetina: true,
      interactivity: {
        events: {
          onClick: {
            enable: interactive,
            mode: "push",
          },
          onHover: {
            enable: false,
            mode: "repulse",
          },
        },
        modes: {
          push: {
            quantity: 3,
          },
          repulse: {
            distance: 120,
            duration: 0.4,
          },
        },
      },
      particles: {
        number: {
          value: particleDensity,
          density: {
            enable: true,
            width: 400,
            height: 400,
          },
        },
        color: {
          value: particleColor,
        },
        shape: {
          type: "circle",
        },
        opacity: {
          value: { min: 0.08, max: 0.55 },
          animation: {
            enable: true,
            speed,
            sync: false,
            startValue: "random",
          },
        },
        size: {
          value: { min: minSize, max: maxSize },
        },
        move: {
          enable: true,
          direction: "none",
          random: false,
          straight: false,
          outModes: {
            default: "out",
          },
          speed: { min: 0.05, max: 0.35 },
        },
        links: {
          enable: false,
        },
      },
    }),
    [
      background,
      interactive,
      maxSize,
      minSize,
      particleColor,
      particleDensity,
      speed,
    ],
  );

  if (!motionOk) {
    return null;
  }

  return (
    <ParticlesProvider init={registerSlimPlugins}>
      <motion.div animate={controls} className={cn("opacity-0", className)}>
        <Particles
          id={id || generatedId.replace(/:/g, "")}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={options}
        />
      </motion.div>
    </ParticlesProvider>
  );
};
