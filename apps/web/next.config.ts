import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@brawlwiki/shared'],
  // El CSS (~7 KB gzip) va dentro del HTML: ahorra una ida y vuelta antes del primer pintado en redes móviles.
  experimental: { inlineCss: true },
  images: {
    remotePatterns: [new URL('https://cdn.brawlify.com/**')],
  },
};

export default nextConfig;
