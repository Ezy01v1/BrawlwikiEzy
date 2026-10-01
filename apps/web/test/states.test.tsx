import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { ApiError } from '@/lib/api';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const meta = (source: 'fresh' | 'cache' | 'stale', ageSeconds = 0) => ({
  source,
  fetchedAt: '2026-09-29T12:00:00.000Z',
  ageSeconds,
});

afterEach(() => {
  refresh.mockClear();
  vi.useRealTimers();
});

describe('StaleBadge', () => {
  it('no se muestra con datos frescos o de caché', () => {
    const { container } = render(
      <>
        <StaleBadge meta={meta('fresh')} />
        <StaleBadge meta={meta('cache', 90)} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('con stale muestra la edad del dato', () => {
    render(<StaleBadge meta={meta('stale', 7200)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Dato de hace 2 h · Supercell no responde');
  });
});

describe('ErrorState', () => {
  it('título humano según el código, mensaje e ID del request', () => {
    render(<ErrorState code="NETWORK" message="No pudimos conectar con el servidor de BrawlWiki." requestId="req-1" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos conectar con BrawlWiki');
    expect(alert).toHaveTextContent('No pudimos conectar con el servidor de BrawlWiki.');
    expect(alert).toHaveTextContent('req-1');
  });

  it('con retryAfter cuenta hacia atrás y luego permite reintentar (router.refresh)', () => {
    vi.useFakeTimers();
    render(<ErrorState code="RATE_LIMITED" message="Espera" retryAfter={2} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Vas muy rápido');
    expect(screen.getByRole('button', { name: 'Reintentar en 2 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('button', { name: 'Reintentar en 1 s' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1000));
    const button = screen.getByRole('button', { name: 'Reintentar' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('usa onRetry si se pasa', () => {
    const onRetry = vi.fn();
    render(<ErrorState code="INTERNAL" message="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ApiErrorView y EmptyState', () => {
  it('mantenimiento → aviso de mantenimiento; otros → ErrorState', () => {
    const { unmount } = render(
      <ApiErrorView error={new ApiError('UPSTREAM_MAINTENANCE', 'x', { status: 503 })} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Brawl Stars está en mantenimiento');
    unmount();
    render(<ApiErrorView error={new ApiError('UPSTREAM_UNAVAILABLE', 'No pudimos contactar a Supercell.', { status: 503 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Supercell no responde');
  });

  it('EmptyState', () => {
    render(<EmptyState title="Sin partidas recientes">Juega una partida.</EmptyState>);
    expect(screen.getByText('Sin partidas recientes')).toBeInTheDocument();
    expect(screen.getByText('Juega una partida.')).toBeInTheDocument();
  });
});
