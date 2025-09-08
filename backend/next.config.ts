import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: require('path').resolve(__dirname, '../'),
  typescript: {
    ignoreBuildErrors: true,  // TypeScript 오류 무시
  },
  eslint: {
    ignoreDuringBuilds: true, // 빌드 시 ESLint 무시
  }
};

export default nextConfig;
