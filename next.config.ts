import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // This setting ensures production builds complete successfully even if there are warnings
    ignoreDuringBuilds: true,
  },
  // Configure static export for Cloudflare Pages
  output: 'export', 
  // Optimize production builds
  productionBrowserSourceMaps: false,
  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Disable image optimization (we're using external CDN)
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-fa2dabd7eff54614b1563a0863fb7cbc.r2.dev',
        pathname: '/**',
      },
    ],
  },
  // Configure which output files to include/exclude in the deployment
  distDir: 'dist',
  // Clean webpack output and avoid caching
  webpack: (config, { dev, isServer }) => {
    // Clean webpack output
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          maxSize: 20000000, // 20MB max chunks
        }
      };
    }
    return config;
  },
};

export default nextConfig;
