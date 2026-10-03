import { ButtonLink } from '@/components/ui/Button';

export default function BrawlerNotFound() {
  return (
    <div className="mx-auto my-12 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese brawler</h1>
      <p className="mt-2 text-sm text-muted">Puede que el link esté mal o que el brawler todavía no exista.</p>
      <ButtonLink href="/brawlers" className="mt-6">
        Ver todos los brawlers
      </ButtonLink>
    </div>
  );
}
