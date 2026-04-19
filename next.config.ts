import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  images: {
    remotePatterns: [],
  },
  // Allow the Python parser service URL to be injected at runtime
  env: {
    PARSER_SERVICE_URL: process.env.PARSER_SERVICE_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
