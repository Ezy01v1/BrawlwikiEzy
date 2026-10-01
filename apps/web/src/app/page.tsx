import { Suspense } from 'react';
import { EventRotation } from '@/components/events/EventRotation';
import { EventsSkeleton } from '@/components/events/EventsSkeleton';
import { SavedList } from '@/components/search/RecentSearches';
import { TagSearch } from '@/components/search/TagSearch';

export default function HomePage() {
  return (
    <>
      <section className="mx-auto mt-6 max-w-xl rounded-card border border-border bg-surface p-5">
        <h1 className="text-center font-display text-3xl">Busca tu perfil</h1>
        <p className="mb-4 mt-1 text-center text-sm text-muted">
          Escribe tu tag de Brawl Stars. Lo encuentras en el juego, debajo de tu nombre.
        </p>
        <TagSearch variant="hero" />
      </section>
      <div className="mx-auto max-w-xl">
        <SavedList source="favorites" />
        <SavedList source="recent" />
      </div>
      <section aria-labelledby="eventos" className="my-8">
        <h2 id="eventos" className="mb-3 font-display text-xl">
          Eventos ahora
        </h2>
        <Suspense fallback={<EventsSkeleton />}>
          <EventRotation />
        </Suspense>
      </section>
    </>
  );
}
