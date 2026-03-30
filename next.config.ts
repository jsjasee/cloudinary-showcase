import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  /* Increase the limit to 70mb since our file size limit is 70mb, without specifying this, nextjs will default to 10mb */
  experimental: {
    proxyClientMaxBodySize: "70mb",
  },
};

export default nextConfig;
