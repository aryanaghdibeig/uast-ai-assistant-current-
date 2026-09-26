import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingIncludes: {
    "/api/chat": ["./data/org-knowledge/index.json"],
    "/api/knowledge/org/reindex": ["./data/org-knowledge/index.json"],
  },
};

export default nextConfig;
