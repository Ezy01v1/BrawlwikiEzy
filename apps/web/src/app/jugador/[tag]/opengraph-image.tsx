import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { DISCLAIMER } from '@/components/ui/Disclaimer';
import { attempt } from '@/lib/attempt';
import { sortBrawlers } from '@/lib/brawlers';
import { displayName, formatNumber } from '@/lib/format';
import { resolveTag } from '@/lib/player-route';
import { getPlayer } from '@/lib/queries';

export const alt = 'Perfil de jugador de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// `next dev` y `next start` corren con cwd = apps/web.
const lilita = readFile(join(process.cwd(), 'src/assets/fonts/LilitaOne-Regular.ttf'));

const C = { bg: '#0b0b0f', surface: '#15151c', border: '#2c2c3a', fg: '#f2f2f5', muted: '#a1a1b3', primary: '#ffc61a' };
const DISPLAY = 'Lilita One';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getPlayer(tag)) : null;
  const player = r?.ok ? r.value.data : null;
  const top = player ? sortBrawlers(player.brawlers, 'trofeos').slice(0, 3) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          color: C.fg,
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 36, color: C.primary }}>BRAWLWIKI</div>
        {player ? (
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, marginTop: 28 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: DISPLAY,
                fontSize: 84,
                lineHeight: 1.1,
                maxWidth: 1072,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {player.name}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: C.muted, marginTop: 8 }}>
              {`#${player.tag} · Nivel ${player.expLevel}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 96, color: C.primary }}>{formatNumber(player.trophies)}</span>
              <span style={{ fontSize: 32, color: C.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {top.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: C.surface,
                    border: `2px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 20px',
                    marginRight: 16,
                  }}
                >
                  <span style={{ fontFamily: DISPLAY, fontSize: 30 }}>{displayName(b.name)}</span>
                  <span style={{ fontSize: 24, color: C.muted }}>{`${formatNumber(b.trophies)} trofeos`}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', fontFamily: DISPLAY, fontSize: 72 }}>
            Stats de Brawl Stars
          </div>
        )}
        <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{DISCLAIMER}</div>
      </div>
    ),
    { ...size, fonts: [{ name: DISPLAY, data: await lilita, style: 'normal', weight: 400 }] },
  );
}
