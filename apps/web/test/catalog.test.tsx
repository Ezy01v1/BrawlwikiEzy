import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrawlerFiltersForm } from '@/components/brawler/BrawlerFiltersForm';
import { CatalogTile } from '@/components/brawler/CatalogTile';
import {
  brawlerFacets,
  classLabel,
  filterBrawlers,
  parseBrawlerFilters,
  rarityLabel,
} from '@/lib/catalog';
import { CATALOG, catalogBrawler } from './fixtures';

const names = (list: { name: string }[]) => list.map((b) => b.name);

describe('lib/catalog', () => {
  it('traduce rarezas y clases y deja tal cual lo desconocido', () => {
    expect(rarityLabel('Super Rare')).toBe('Súper raro');
    expect(rarityLabel('Ultra Legendary')).toBe('Ultra legendario');
    expect(rarityLabel('Nueva')).toBe('Nueva');
    expect(classLabel('Tank')).toBe('Tanque');
    expect(classLabel('Rara')).toBe('Rara');
  });

  it('filterBrawlers: búsqueda sin acentos ni mayúsculas, rareza y clase', () => {
    expect(names(filterBrawlers(CATALOG, {}))).toEqual(['SHELLY', 'COLT', 'BULL', 'BROCK']);
    expect(names(filterBrawlers(CATALOG, { q: 'bu' }))).toEqual(['BULL']);
    expect(names(filterBrawlers(CATALOG, { q: '  Shélly ' }))).toEqual(['SHELLY']);
    expect(names(filterBrawlers([catalogBrawler({ name: 'EL PRIMO' })], { q: 'el primo' }))).toEqual(['EL PRIMO']);
    expect(names(filterBrawlers([catalogBrawler({ name: '8-BIT' })], { q: '8-bit' }))).toEqual(['8-BIT']);
    expect(names(filterBrawlers(CATALOG, { rareza: 'Rare' }))).toEqual(['BULL']);
    expect(names(filterBrawlers(CATALOG, { clase: 'Tank', q: 'sh' }))).toEqual([]);
  });

  it('brawlerFacets: solo valores presentes, y nada si no hay metadatos', () => {
    const list = [
      ...CATALOG,
      catalogBrawler({ id: 16000010, name: 'EPICO', rarity: { name: 'Epic', color: '#d850ff' }, class: 'Support' }),
      catalogBrawler({ id: 16000011, name: 'COMUN', rarity: { name: 'Common', color: '#b9eaff' }, class: 'Tank' }),
    ];
    // Las clases van por su nombre en español: "Apoyo" (Support) antes que "Tanque" (Tank).
    expect(brawlerFacets(list)).toEqual({ rarities: ['Common', 'Rare', 'Epic'], classes: ['Support', 'Tank'] });
    expect(brawlerFacets(CATALOG.map((b) => ({ ...b, rarity: null, class: null })))).toEqual({ rarities: [], classes: [] });
  });

  it('parseBrawlerFilters: toma el primer valor, recorta y descarta vacíos', () => {
    expect(parseBrawlerFilters({ q: ['  bu ', 'x'], rareza: '', clase: undefined })).toEqual({ q: 'bu' });
    expect(parseBrawlerFilters({ rareza: 'Rare', clase: 'Tank' })).toEqual({ rareza: 'Rare', clase: 'Tank' });
  });
});

describe('componentes del catálogo', () => {
  it('CatalogTile: link al detalle con nombre y rareza en español', () => {
    render(<CatalogTile brawler={CATALOG[2]!} />);
    const link = screen.getByRole('link', { name: 'Bull, Raro' });
    expect(link).toHaveAttribute('href', '/brawlers/16000002');
    expect(screen.getByText('Bull')).toBeInTheDocument();
    expect(screen.getByText('Raro')).toBeInTheDocument();
  });

  it('BrawlerFiltersForm: sin metadatos solo hay búsqueda; con metadatos aparecen los selects', () => {
    const { container, unmount } = render(
      <BrawlerFiltersForm facets={{ rarities: [], classes: [] }} values={{}} />,
    );
    const form = container.querySelector('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/brawlers');
    expect(screen.getByLabelText('Buscar brawler')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rareza')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clase')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quitar filtros' })).not.toBeInTheDocument();
    unmount();
    render(<BrawlerFiltersForm facets={{ rarities: ['Rare'], classes: ['Tank'] }} values={{ q: 'bu', rareza: 'Rare' }} />);
    expect(screen.getByLabelText('Buscar brawler')).toHaveValue('bu');
    expect(screen.getByLabelText('Rareza')).toHaveValue('Rare');
    expect(screen.getByRole('option', { name: 'Raro' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tanque' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quitar filtros' })).toHaveAttribute('href', '/brawlers');
  });
});
