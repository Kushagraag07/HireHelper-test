import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // HTTP proxy for REST
      { source: "/api/:path*", destination: "http://localhost:8000/:path*" },
    ]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
};

export default nextConfig;
