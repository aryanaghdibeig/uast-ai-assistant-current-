// lib/config/feature-flags.ts
// Stage 4 prep — incomplete org/RAG/agent capabilities stay OFF by default.

function envFlag(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

/**
 * Product feature gates. Defaults are false so unfinished capabilities
 * cannot activate accidentally in any environment.
 */
export const featureFlags = {
  /** Organization / unit / membership access model — not implemented. */
  orgAccess: envFlag("FEATURE_ORG_ACCESS"),

  /** Document KB RAG (chunk/embed/index) — not implemented; file inline remains. */
  documentRag: envFlag("FEATURE_DOCUMENT_RAG"),

  /** Agent runtime + tool-calling — not in approved scope yet. */
  agentRuntime: envFlag("FEATURE_AGENT_RUNTIME"),
} as const;

export type FeatureFlagName = keyof typeof featureFlags;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return featureFlags[name] === true;
}
