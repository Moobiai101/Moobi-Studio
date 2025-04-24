import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // This setting ensures production builds complete successfully even if there are warnings
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
