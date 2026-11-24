import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.73"],
  experimental: {
    serverActions: {
      // Dev preview proxy (browser origin includes its own port).
      allowedOrigins: ["127.0.0.1:61614", "localhost:61614"],
    },
  },
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
