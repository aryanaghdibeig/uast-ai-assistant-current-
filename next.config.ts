import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
