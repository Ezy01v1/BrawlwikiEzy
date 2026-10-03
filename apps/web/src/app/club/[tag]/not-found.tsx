import { TagSearch } from '@/components/search/TagSearch';

export default function ClubNotFound() {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese club</h1>
      <p className="mb-4 mt-2 text-sm text-muted">
        Revisa el tag en la pantalla del club dentro del juego. Si el club se cerró, ya no aparece.
      </p>
      <div className="text-left">
        <TagSearch variant="hero" target="club" />
      </div>
    </div>
  );
}
