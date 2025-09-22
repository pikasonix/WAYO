import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Strict Mode in dev to prevent double-mount that interferes with Mapbox GL
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jrxpkakimcdfecdepmyu.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      // Add other allowed hostnames here if needed
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Surface Mapbox token to the browser. Prefer NEXT_PUBLIC_ but fall back to VITE_ for compatibility
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN:
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN,
  },
};

export default nextConfig;
