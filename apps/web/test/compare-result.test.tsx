import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareResult } from '@/components/club/CompareResult';
import { ApiError } from '@/lib/api';

const getClub = vi.fn();
vi.mock('@/lib/queries', () => ({ getClub: (...a: unknown[]) => getClub(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const down = () => new ApiError('UPSTREAM_UNAVAILABLE', 'detalle del 503', { status: 503 });
const missing = () => new ApiError('NOT_FOUND', 'No existe', { status: 404 });

beforeEach(() => {
  getClub.mockReset();
});

describe('CompareResult', () => {
  it('el mismo error en los dos clubes se muestra una sola vez', async () => {
    getClub.mockRejectedValue(down());
    render(await CompareResult({ a: 'AAA', b: 'BBB' }));
    expect(screen.getAllByText('detalle del 503')).toHaveLength(1);
    expect(screen.queryByText(/Club A/)).not.toBeInTheDocument();
  });

  it('errores distintos dicen a qué club corresponde cada uno', async () => {
    getClub.mockImplementation((tag: string) => Promise.reject(tag === 'AAA' ? missing() : down()));
    render(await CompareResult({ a: 'AAA', b: 'BBB' }));
    expect(screen.getByText('No encontramos el club #AAA')).toBeInTheDocument();
    expect(screen.getByText('Club A')).toBeInTheDocument();
    expect(screen.getByText('Club B')).toBeInTheDocument();
  });
});
