'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ApiErrorCode } from '@/lib/api';

const TITLES: Partial<Record<ApiErrorCode, string>> = {
  RATE_LIMITED: 'Vas muy rápido 😅',
  UPSTREAM_RATE_LIMITED: 'Vas muy rápido 😅',
  UPSTREAM_UNAVAILABLE: 'Supercell no responde',
  NETWORK: 'No pudimos conectar con BrawlWiki',
  INVALID_TAG: 'Revisa el tag',
  INVALID_PARAM: 'Revisa los filtros',
  NOT_FOUND: 'No encontramos lo que buscas',
};

export function errorTitle(code: ApiErrorCode): string {
  return TITLES[code] ?? 'Algo salió mal';
}

export interface ErrorStateProps {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  retryAfter?: number;
  onRetry?: () => void;
}

export function ErrorState({ code, message, requestId, retryAfter, onRetry }: ErrorStateProps) {
  const router = useRouter();
  const [wait, setWait] = useState(retryAfter ?? 0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  return (
    <div role="alert" className="mx-auto my-8 max-w-md rounded-card border border-border bg-surface p-6 text-center">
      <h2 className="font-display text-xl">{errorTitle(code)}</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <Button className="mt-4" disabled={wait > 0} onClick={() => (onRetry ? onRetry() : router.refresh())}>
        {wait > 0 ? `Reintentar en ${wait} s` : 'Reintentar'}
      </Button>
      {requestId && <p className="mt-3 text-[11px] text-muted">ID: {requestId}</p>}
    </div>
  );
}
