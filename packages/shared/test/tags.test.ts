import { describe, expect, it } from 'vitest';
import { isValidTag, normalizeTag, parseTag } from '../src/tags';

describe('normalizeTag', () => {
  it('quita #, espacios y pasa a mayúsculas', () => {
    expect(normalizeTag('  #2pp ')).toBe('2PP');
  });
  it('reemplaza la letra O por el cero', () => {
    expect(normalizeTag('#8oQu')).toBe('80QU');
  });
  it('acepta %23 de una URL', () => {
    expect(normalizeTag('%232PP')).toBe('2PP');
  });
});

describe('isValidTag', () => {
  it('acepta solo el alfabeto de Supercell', () => {
    expect(isValidTag('2PP')).toBe(true);
    expect(isValidTag('ABC')).toBe(false);
  });
  it('exige entre 3 y 14 caracteres', () => {
    expect(isValidTag('2P')).toBe(false);
    expect(isValidTag('2'.repeat(14))).toBe(true);
    expect(isValidTag('2'.repeat(15))).toBe(false);
  });
});

describe('parseTag', () => {
  it('devuelve el tag normalizado si es válido', () => {
    expect(parseTag('#2pp')).toBe('2PP');
  });
  it('devuelve null si es inválido', () => {
    expect(parseTag('hola!')).toBeNull();
    expect(parseTag('')).toBeNull();
  });
});
