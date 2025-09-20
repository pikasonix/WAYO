import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;
