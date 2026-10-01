import { TagSearch } from '@/components/search/TagSearch';

export default function PlayerNotFound() {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">No encontramos ese jugador</h1>
      <p className="mb-4 mt-2 text-sm text-muted">
        Revisa el tag en tu perfil dentro del juego. Si la cuenta es nueva, puede tardar un rato en aparecer.
      </p>
      <div className="text-left">
        <TagSearch variant="hero" />
      </div>
    </div>
  );
}
