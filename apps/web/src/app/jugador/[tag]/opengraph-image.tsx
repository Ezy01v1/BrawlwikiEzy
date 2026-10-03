import { ImageResponse } from 'next/og';
import { attempt } from '@/lib/attempt';
import { sortBrawlers } from '@/lib/brawlers';
import { displayName, formatNumber } from '@/lib/format';
import { OG_BOX, OG_COLORS, OG_DISPLAY, OG_TITLE, OgFallback, OgFrame, ogFonts } from '@/lib/og';
import { getPlayer } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export const alt = 'Perfil de jugador de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getPlayer(tag)) : null;
  const player = r?.ok ? r.value.data : null;
  const top = player ? sortBrawlers(player.brawlers, 'trofeos').slice(0, 3) : [];

  return new ImageResponse(
    (
      <OgFrame>
        {player ? (
          <>
            <div style={OG_TITLE}>{player.name}</div>
            <div style={{ display: 'flex', fontSize: 32, color: OG_COLORS.muted, marginTop: 8 }}>
              {`#${player.tag} · Nivel ${player.expLevel}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: OG_DISPLAY, fontSize: 96, color: OG_COLORS.primary }}>
                {formatNumber(player.trophies)}
              </span>
              <span style={{ fontSize: 32, color: OG_COLORS.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {top.map((b) => (
                <div key={b.id} style={OG_BOX}>
                  <span style={{ fontFamily: OG_DISPLAY, fontSize: 30 }}>{displayName(b.name)}</span>
                  <span style={{ fontSize: 24, color: OG_COLORS.muted }}>{`${formatNumber(b.trophies)} trofeos`}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <OgFallback />
        )}
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
