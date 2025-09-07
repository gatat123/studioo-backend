/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // Canvas 모듈을 클라이언트 측에서만 로드되도록 설정
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }

    // Konva.js가 서버사이드에서 실행되지 않도록 설정
    config.externals = [...(config.externals || []), 'canvas'];

    return config;
  },
}

export default nextConfig
