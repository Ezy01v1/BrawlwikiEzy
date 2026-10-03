import { TagSearch } from '@/components/search/TagSearch';

export function InvalidTag({ target = 'player' }: { target?: 'player' | 'club' }) {
  return (
    <div className="mx-auto my-10 max-w-md text-center">
      <h1 className="font-display text-2xl">Tag inválido</h1>
      <p className="mt-2 text-sm text-muted">
        Los tags de Brawl Stars solo usan estos caracteres:{' '}
        <strong className="font-mono tracking-wider text-fg">0289PYLQGRJCUV</strong>. Si ves una letra O, en realidad es
        un cero (0).
      </p>
      <div className="mt-4 text-left">
        <TagSearch variant="hero" target={target} />
      </div>
    </div>
  );
}
