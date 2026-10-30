import { getSession } from '@/lib/session';
import { ClaimTagButton } from './ClaimTagButton';

/**
 * "Este soy yo" en el perfil de `tag`: solo con Comunidad activa y con sesión. Si el tag ya es el vinculado no hay
 * botón, pero el componente sigue montado para que su `role="status"` anuncie el éxito tras la revalidación.
 */
export async function ClaimTag({ tag }: { tag: string }) {
  const { enabled, user } = await getSession();
  if (!enabled || !user) return null;
  return <ClaimTagButton tag={tag} linked={user.playerTag === tag} />;
}
