import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // This setting ensures production builds complete successfully even if there are warnings
    ignoreDuringBuilds: true,
  },
  // Use static export for Cloudflare Pages deployment
  output: 'export',
  // Optimize production builds
  productionBrowserSourceMaps: false,
  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Disable image optimization (we're using R2 for images)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
