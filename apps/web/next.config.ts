import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@brawlwiki/shared'],
  // El CSS (~7 KB gzip) va dentro del HTML: ahorra una ida y vuelta antes del primer pintado en redes móviles.
  experimental: { inlineCss: true },
  images: {
    // Discord: avatares de las cuentas de Comunidad (la API los arma como cdn.discordapp.com/avatars/<id>/<hash>.png).
    remotePatterns: [new URL('https://cdn.brawlify.com/**'), new URL('https://cdn.discordapp.com/avatars/**')],
  },
};

export default nextConfig;
