import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "../dist/renderer",
  images: {
    unoptimized: true
  }
};

export default nextConfig;
