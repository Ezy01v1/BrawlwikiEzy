import { describe, expect, it } from 'vitest';
import { parseSupercellDate } from '../src/dates';

describe('parseSupercellDate', () => {
  it('convierte el formato compacto de Supercell a ISO 8601', () => {
    expect(parseSupercellDate('20260928T120000.000Z')).toBe('2026-09-28T12:00:00.000Z');
  });
  it('lanza error con formato inválido', () => {
    expect(() => parseSupercellDate('ayer')).toThrow('Fecha de Supercell inválida');
  });
});
