/** Origin del sitio público: lo que la API compara con `PUBLIC_SITE_URL` en los requests que modifican. */
export function siteOrigin(): string {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').origin;
}
