import type { ApiError } from '@/lib/api';
import { ErrorState } from './ErrorState';
import { MaintenanceNotice } from './MaintenanceNotice';

/** Los errores de la API se renderizan en línea: en producción Next oculta el mensaje de los errores lanzados. */
export function ApiErrorView({ error }: { error: ApiError }) {
  if (error.code === 'UPSTREAM_MAINTENANCE') return <MaintenanceNotice />;
  return (
    <ErrorState
      key={error.requestId ?? error.code}
      code={error.code}
      message={error.message}
      requestId={error.requestId}
      retryAfter={error.retryAfter}
    />
  );
}
