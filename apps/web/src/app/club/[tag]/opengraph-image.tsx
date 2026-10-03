import { ImageResponse } from 'next/og';
import { attempt } from '@/lib/attempt';
import { CLUB_CAPACITY, clubTypeLabel, summarizeClub } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';
import { OG_BOX, OG_COLORS, OG_DISPLAY, OG_TITLE, OgFallback, OgFrame, ogFonts } from '@/lib/og';
import { getClub } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export const alt = 'Club de Brawl Stars en BrawlWiki';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  const r = tag ? await attempt(getClub(tag)) : null;
  const club = r?.ok ? r.value.data : null;
  const s = club ? summarizeClub(club) : null;

  return new ImageResponse(
    (
      <OgFrame>
        {club && s ? (
          <>
            <div style={OG_TITLE}>{club.name}</div>
            <div style={{ display: 'flex', fontSize: 32, color: OG_COLORS.muted, marginTop: 8 }}>
              {`#${club.tag} · ${clubTypeLabel(club.type)}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 28 }}>
              <span style={{ fontFamily: OG_DISPLAY, fontSize: 96, color: OG_COLORS.primary }}>
                {formatNumber(club.trophies)}
              </span>
              <span style={{ fontSize: 32, color: OG_COLORS.muted, marginLeft: 16 }}>trofeos</span>
            </div>
            <div style={{ display: 'flex', marginTop: 24 }}>
              {[
                { label: 'Miembros', value: `${s.members}/${CLUB_CAPACITY}` },
                { label: 'Promedio', value: formatNumber(s.average) },
                { label: 'Requeridos', value: formatNumber(club.requiredTrophies) },
              ].map((box) => (
                <div key={box.label} style={OG_BOX}>
                  <span style={{ fontFamily: OG_DISPLAY, fontSize: 30 }}>{box.value}</span>
                  <span style={{ fontSize: 24, color: OG_COLORS.muted }}>{box.label}</span>
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
