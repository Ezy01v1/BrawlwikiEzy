import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CSSProperties, ReactNode } from 'react';
import { DISCLAIMER } from '@/components/ui/Disclaimer';

export const OG_COLORS = {
  bg: '#0b0b0f',
  surface: '#15151c',
  border: '#2c2c3a',
  fg: '#f2f2f5',
  muted: '#a1a1b3',
  primary: '#ffc61a',
};
export const OG_DISPLAY = 'Lilita One';
const OG_BODY = 'Geist';

// `next dev` y `next start` corren con cwd = apps/web.
const font = (file: string) => readFile(join(process.cwd(), 'src/assets/fonts', file));
const lilita = font('LilitaOne-Regular.ttf');
const geist = font('Geist-Regular.ttf');

/** Pasar `fonts` a ImageResponse reemplaza la fuente por defecto de next/og: Geist va primero para el cuerpo. */
export async function ogFonts() {
  return [
    { name: OG_BODY, data: await geist, style: 'normal' as const, weight: 400 as const },
    { name: OG_DISPLAY, data: await lilita, style: 'normal' as const, weight: 400 as const },
  ];
}

/** Título grande de una sola línea, cortado con "…" si no entra. */
export const OG_TITLE: CSSProperties = {
  display: 'flex',
  fontFamily: OG_DISPLAY,
  fontSize: 84,
  lineHeight: 1.1,
  maxWidth: 1072,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

/** Caja de dato (valor arriba, etiqueta abajo) que comparten las imágenes OG. */
export const OG_BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: OG_COLORS.surface,
  border: `2px solid ${OG_COLORS.border}`,
  borderRadius: 12,
  padding: '12px 20px',
  marginRight: 16,
};

/** Marco común: marca arriba, contenido en el medio y disclaimer al pie. Satori exige display:flex en cada div con varios hijos. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG_COLORS.bg,
        color: OG_COLORS.fg,
        padding: 64,
        fontFamily: OG_BODY,
      }}
    >
      <div style={{ display: 'flex', fontFamily: OG_DISPLAY, fontSize: 36, color: OG_COLORS.primary }}>BRAWLWIKI</div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, marginTop: 28 }}>{children}</div>
      <div style={{ display: 'flex', fontSize: 22, color: OG_COLORS.muted }}>{DISCLAIMER}</div>
    </div>
  );
}

export function OgFallback() {
  return (
    <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', fontFamily: OG_DISPLAY, fontSize: 72 }}>
      Stats de Brawl Stars
    </div>
  );
}
