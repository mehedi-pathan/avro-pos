import type { NextConfig } from "next";

/** During `next dev`, a custom distDir under ../dist/renderer is brittle (missing routes-manifest after clean builds). */
const distDir =
  process.env.NODE_ENV === "production" ? "../dist/renderer" : ".next";

const nextConfig: NextConfig = {
  output: "export",
  distDir,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
