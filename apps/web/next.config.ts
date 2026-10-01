import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@brawlwiki/shared'],
  images: {
    remotePatterns: [new URL('https://cdn.brawlify.com/**')],
  },
};

export default nextConfig;
