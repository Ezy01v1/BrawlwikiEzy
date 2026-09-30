import { describe, expect, it } from 'vitest';
import { parseBrawlerId, parseLimit, parseRegion, parseTagParam } from '../src/http/params';

describe('params', () => {
  it('parseTagParam normaliza y valida', () => {
    expect(parseTagParam('#2pp')).toBe('2PP');
    expect(() => parseTagParam('hola')).toThrow(expect.objectContaining({ code: 'INVALID_TAG' }));
    expect(() => parseTagParam(undefined)).toThrow(expect.objectContaining({ code: 'INVALID_TAG' }));
  });

  it('parseRegion: global por defecto, país en mayúsculas, resto inválido', () => {
    expect(parseRegion(undefined)).toBe('global');
    expect(parseRegion('GLOBAL')).toBe('global');
    expect(parseRegion('mx')).toBe('MX');
    for (const bad of ['mexico', 'm', '12', ['MX']]) {
      expect(() => parseRegion(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });

  it('parseLimit: 50 por defecto, 1..200, resto inválido', () => {
    expect(parseLimit(undefined)).toBe(50);
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('200')).toBe(200);
    for (const bad of ['0', '201', '500', 'abc', '1.5', '-3', ['10']]) {
      expect(() => parseLimit(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });

  it('parseBrawlerId: exactamente 8 dígitos', () => {
    expect(parseBrawlerId('16000000')).toBe(16000000);
    for (const bad of ['1600', 'shelly', '160000001', undefined]) {
      expect(() => parseBrawlerId(bad)).toThrow(expect.objectContaining({ code: 'INVALID_PARAM' }));
    }
  });
});
