import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ClubHeader } from '@/components/club/ClubHeader';
import { ClubMemberList } from '@/components/club/ClubMemberList';
import { ClubStats } from '@/components/club/ClubStats';
import { InvalidTag } from '@/components/player/InvalidTag';
import { RecordVisit } from '@/components/search/RecordVisit';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { StaleBadge } from '@/components/states/StaleBadge';
import { ButtonLink } from '@/components/ui/Button';
import { attempt } from '@/lib/attempt';
import { CLUB_CAPACITY } from '@/lib/clubs';
import { formatNumber } from '@/lib/format';
import { getClub } from '@/lib/queries';
import { resolveTag } from '@/lib/route-params';

export async function generateMetadata({ params }: PageProps<'/club/[tag]'>): Promise<Metadata> {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return { title: 'Tag inválido' };
  if (tag !== raw) return {}; // la página redirige al tag canónico
  const r = await attempt(getClub(tag));
  if (!r.ok) return { title: `Club #${tag}` };
  const c = r.value.data;
  return {
    title: `${c.name} (#${c.tag})`,
    description: `Club de Brawl Stars · ${formatNumber(c.trophies)} trofeos · ${c.members.length}/${CLUB_CAPACITY} miembros.`,
  };
}

export default async function ClubPage({ params }: PageProps<'/club/[tag]'>) {
  const { tag: raw } = await params;
  const tag = resolveTag(raw);
  if (!tag) return <InvalidTag target="club" />;
  if (tag !== raw) redirect(`/club/${tag}`);

  const r = await attempt(getClub(tag));
  if (!r.ok) {
    if (r.error.code === 'NOT_FOUND') notFound();
    if (r.error.code === 'INVALID_TAG') return <InvalidTag target="club" />;
    return <ApiErrorView error={r.error} />;
  }

  const { data: club, meta } = r.value;
  return (
    <>
      <RecordVisit entry={{ type: 'club', tag: club.tag, name: club.name }} />
      <ClubHeader club={club} />
      <StaleBadge meta={meta} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div>
          <ClubStats club={club} />
          <ButtonLink href={`/clubes/comparar?a=${club.tag}`} variant="secondary" className="mt-3 w-full">
            Comparar con otro club
          </ButtonLink>
        </div>
        <ClubMemberList members={club.members} />
      </div>
    </>
  );
}
