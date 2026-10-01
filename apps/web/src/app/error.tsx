'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/states/ErrorState';

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      code="INTERNAL"
      message="Ocurrió un error inesperado al mostrar esta página."
      requestId={error.digest}
      onRetry={retry}
    />
  );
}
