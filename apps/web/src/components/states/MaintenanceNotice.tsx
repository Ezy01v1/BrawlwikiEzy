export function MaintenanceNotice() {
  return (
    <div role="status" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
      <p aria-hidden="true" className="text-3xl">
        🛠️
      </p>
      <h2 className="mt-2 font-display text-xl">Brawl Stars está en mantenimiento</h2>
      <p className="mt-2 text-sm text-muted">Supercell está actualizando el juego. Vuelve en un rato.</p>
    </div>
  );
}
