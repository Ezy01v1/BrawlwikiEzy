import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-md text-center">
      <p className="font-display text-5xl text-primary">404</p>
      <h1 className="mt-2 font-display text-2xl">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-muted">Puede que el link esté mal o que la sección todavía no exista.</p>
      <ButtonLink href="/" className="mt-6">
        Volver al inicio
      </ButtonLink>
    </div>
  );
}
