import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Export estático para GitHub Pages (publicado em .../apps/color-palette/).
  output: "export",
  basePath: "/simuladores-interativos/apps/color-palette",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
