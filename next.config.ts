import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.SHIXU_STANDALONE === "1" ? "standalone" : undefined,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
