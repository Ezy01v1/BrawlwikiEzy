import { canClaimTag } from '@/lib/account';
import { getSession } from '@/lib/session';
import { ClaimTagButton } from './ClaimTagButton';

/** Decide en el servidor si el perfil de `tag` ofrece "Este soy yo". */
export async function ClaimTag({ tag }: { tag: string }) {
  const session = await getSession();
  if (!canClaimTag(session, tag)) return null;
  return <ClaimTagButton tag={tag} />;
}
