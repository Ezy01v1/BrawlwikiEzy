export const DISCLAIMER = 'Este material es no oficial y no está avalado por Supercell.';

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-muted ${className}`}>{DISCLAIMER}</p>;
}
