/** Único lugar del default: el puerto de desarrollo de la web es 3200, igual que el PUBLIC_SITE_URL por defecto de la API. */
export const DEFAULT_SITE_URL = 'http://localhost:3200';

/** Origin del sitio público: lo que la API compara con `PUBLIC_SITE_URL` en los requests que modifican. */
export function siteOrigin(): string {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).origin;
}
