// components/chat/PageAtmosphere.tsx

"use client";

import Image from "next/image";
import styles from "@/app/Chat.module.css";
import { SparklesCore } from "@/components/ui/sparkles";
import { useUastTheme } from "@/components/layout/ThemeToggle";
import {
  defaultHubScene,
  deputies,
  getDeputyById,
  type DeputyId,
} from "@/lib/org/deputies";

type PageAtmosphereProps = {
  selectedDeputyId: DeputyId | null;
  previewDeputyId: DeputyId | null;
};

export default function PageAtmosphere({
  selectedDeputyId,
  previewDeputyId,
}: PageAtmosphereProps) {
  const theme = useUastTheme();
  const activeId = previewDeputyId ?? selectedDeputyId;
  const deputy = getDeputyById(activeId);
  const sceneId = deputy?.id ?? "default";
  const accent = deputy?.accent ?? "#0d9488";
  const particleColor =
    theme === "dark" ? "#f8fafc" : "#0f766e";

  return (
    <div
      className={styles.pageAtmosphere}
      data-scene={sceneId}
      style={
        {
          "--page-scene-accent": accent,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {/* Deepest layer: always-visible space field */}
      <div className={styles.pageAtmosphereBase}>
        <Image
          src={defaultHubScene.image}
          alt=""
          fill
          sizes="100vw"
          className={styles.pageAtmosphereImage}
          style={{ objectPosition: defaultHubScene.position }}
          priority
          unoptimized
        />
        <div
          className={styles.pageAtmosphereWash}
          style={{ background: defaultHubScene.wash }}
        />
      </div>

      {deputies.map((item) => (
        <div
          key={item.id}
          className={`${styles.pageAtmosphereLayer} ${
            sceneId === item.id ? styles.pageAtmosphereLayerActive : ""
          }`}
        >
          <Image
            src={item.scene.image}
            alt=""
            fill
            sizes="100vw"
            className={styles.pageAtmosphereImage}
            style={{ objectPosition: item.scene.position }}
            priority={item.id === "cultural" || item.id === "research"}
            unoptimized={item.scene.image.endsWith(".svg")}
          />
          <div
            className={styles.pageAtmosphereWash}
            style={{ background: item.scene.wash }}
          />
        </div>
      ))}

      <div className={styles.pageAtmosphereSparkles}>
        <SparklesCore
          id="uast-dashboard-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={280}
          speed={1}
          particleColor={particleColor}
          className="h-full w-full"
        />
      </div>

      <div className={styles.pageAtmosphereVeil} />
    </div>
  );
}
