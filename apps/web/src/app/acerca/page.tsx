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
        Sin cuenta, tus favoritos y tus búsquedas recientes se guardan solo en este navegador y puedes borrarlos
        limpiando los datos del sitio.
      </p>

      <h2 className={H2}>Cuentas</h2>
      <p className={P}>
        La cuenta es opcional y se crea al entrar con Discord. Sirve para guardar tus favoritos, vincular tu perfil de
        Brawl Stars y votar en la tier list de la comunidad.
      </p>
      <p className={`mt-2 ${P}`}>
        De tu cuenta guardamos tu id, tu nombre y tu avatar de Discord, el tag que vincules, tus favoritos y tus votos.
        No guardamos tu email ni el token de Discord: al entrar solo pedimos ver tu perfil básico, que no incluye el
        email.
      </p>
      <p className={`mt-2 ${P}`}>
        La sesión se mantiene con una cookie, <code>bw_session</code>, que el navegador no deja leer a ningún script
        (HttpOnly) y que vence tras 30 días sin entrar al sitio.
      </p>
      <p className={`mt-2 ${P}`}>
        La tier list de la comunidad solo muestra resultados agregados: nadie ve cómo votaste tú. Si borras tu cuenta
        desde Mi cuenta, se elimina todo lo que guardamos de ella, incluidos tus favoritos y tus votos. Las copias de
        seguridad diarias se guardan 7 días, así que en ese plazo tus datos desaparecen también de ellas.
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
