import { Disclaimer } from '@/components/ui/Disclaimer';

export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 text-center md:px-6 md:pb-10">
      <Disclaimer />
      <p className="mt-1 text-xs text-muted">Fan page hecha por la comunidad. Datos vía la API oficial de Brawl Stars.</p>
    </footer>
  );
}
