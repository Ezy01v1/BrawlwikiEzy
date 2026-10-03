import type { Metadata } from 'next';
import { Disclaimer } from '@/components/ui/Disclaimer';

export const metadata: Metadata = {
  title: 'Acerca de',
  description: 'Qué es BrawlWiki, de dónde salen sus datos y el aviso legal de esta fan page no oficial.',
};

const H2 = 'mt-8 mb-2 font-display text-lg';
const P = 'text-sm leading-relaxed text-muted';

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mt-6 font-display text-3xl">Acerca de BrawlWiki</h1>
      <p className={`mt-3 ${P}`}>
        BrawlWiki es una fan page hecha por la comunidad para consultar perfiles, clubes, rankings y brawlers de Brawl
        Stars desde el celular, entre partida y partida.
      </p>

      <h2 className={H2}>De dónde salen los datos</h2>
      <p className={P}>
        Los datos vienen de la API oficial de Brawl Stars de Supercell. BrawlWiki guarda una copia por unos minutos para
        responder rápido. Si Supercell no responde, verás el último dato guardado con un aviso de cuánto tiempo tiene.
        Las imágenes de brawlers, mapas e íconos vienen del CDN de Brawlify.
      </p>

      <h2 className={H2}>Tus datos</h2>
      <p className={P}>
        No hay cuentas. Tus favoritos y tus búsquedas recientes se guardan solo en este navegador y puedes borrarlos
        limpiando los datos del sitio.
      </p>

      <h2 className={H2}>Aviso legal</h2>
      <Disclaimer className="text-sm" />
      <p className={`mt-2 ${P}`}>
        BrawlWiki sigue la{' '}
        <a
          href="https://supercell.com/en/fan-content-policy/"
          className="text-fg underline underline-offset-2"
        >
          Fan Content Policy de Supercell
        </a>
        .
      </p>
    </article>
  );
}
