import { describe, expect, it } from 'vitest';
import { parseBrawlerIdParam, resolveTag } from '@/lib/route-params';

describe('route-params', () => {
  it('resolveTag normaliza y parseBrawlerIdParam acepta solo ids de 8 dígitos', () => {
    expect(resolveTag('%232yplq')).toBe('2YPLQ');
    expect(parseBrawlerIdParam('16000000')).toBe(16000000);
    expect(parseBrawlerIdParam('1600000')).toBeNull();
    expect(parseBrawlerIdParam('160000001')).toBeNull();
    expect(parseBrawlerIdParam('16OOOOOO')).toBeNull();
    expect(parseBrawlerIdParam(undefined)).toBeNull();
  });
});
