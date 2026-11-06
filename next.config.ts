import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in Slotwise reads the session or live booking data, so we use
  // classic dynamic rendering instead of Cache Components.
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
