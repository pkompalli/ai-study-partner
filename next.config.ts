import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', 'pdf-parse/worker', '@napi-rs/canvas'],
};

export default nextConfig;
