const SUPERCELL_DATE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/;

export function parseSupercellDate(value: string): string {
  const m = SUPERCELL_DATE.exec(value);
  if (!m) throw new Error(`Fecha de Supercell inválida: ${value}`);
  const [, y, mo, d, h, mi, s, ms] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
}
