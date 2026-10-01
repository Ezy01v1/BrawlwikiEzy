import { describe, expect, it } from 'vitest';
import { displayName, formatAge, formatNumber, signed, timeAgo, timeLeft } from '@/lib/format';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

describe('format', () => {
  it('formatNumber usa separador de miles es-MX', () => {
    expect(formatNumber(42310)).toBe('42,310');
    expect(formatNumber(1200)).toBe('1,200');
    expect(formatNumber(7)).toBe('7');
  });

  it('formatAge', () => {
    expect(formatAge(0)).toBe('unos segundos');
    expect(formatAge(59)).toBe('unos segundos');
    expect(formatAge(60)).toBe('1 min');
    expect(formatAge(3599)).toBe('59 min');
    expect(formatAge(7200)).toBe('2 h');
    expect(formatAge(3 * 86400)).toBe('3 d');
    expect(formatAge(-5)).toBe('unos segundos');
  });

  it('timeAgo', () => {
    expect(timeAgo('2026-09-29T11:56:00.000Z', NOW)).toBe('hace 4 min');
  });

  it('timeLeft', () => {
    expect(timeLeft('2026-09-29T11:00:00.000Z', NOW)).toBe('terminado');
    expect(timeLeft('2026-09-29T12:00:30.000Z', NOW)).toBe('menos de 1 min');
    expect(timeLeft('2026-09-29T12:40:00.000Z', NOW)).toBe('40 min');
    expect(timeLeft('2026-09-29T15:00:00.000Z', NOW)).toBe('3 h');
    expect(timeLeft('2026-09-29T13:20:00.000Z', NOW)).toBe('1 h 20 min');
  });

  it('signed', () => {
    expect(signed(8)).toBe('+8');
    expect(signed(-6)).toBe('−6');
    expect(signed(0)).toBe('0');
  });

  it('displayName pasa nombres de Supercell a formato título', () => {
    expect(displayName('SHELLY')).toBe('Shelly');
    expect(displayName('EL PRIMO')).toBe('El Primo');
    expect(displayName('8-BIT')).toBe('8-Bit');
    expect(displayName('MR. P')).toBe('Mr. P');
  });
});
