import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { LinkTagForm } from '@/components/account/LinkTagForm';
import { EmptyState } from '@/components/states/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GameImage } from '@/components/ui/GameImage';
import { COMMUNITY_UNAVAILABLE, loginHref, profileHref } from '@/lib/account';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };

export default async function CuentaPage() {
  const { enabled, user } = await getSession();
  if (!enabled) {
    return (
      <EmptyState title={COMMUNITY_UNAVAILABLE}>
        El resto de BrawlWiki sigue funcionando. Vuelve a intentarlo en un rato.
      </EmptyState>
    );
  }
  if (!user) redirect(loginHref('/cuenta'));

  return (
    <div className="mx-auto my-6 flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-3xl">Mi cuenta</h1>

      <Card className="flex items-center gap-3">
        <GameImage src={user.avatarUrl} alt="" size={56} fallbackText={user.username} className="rounded-full" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl">{user.username}</p>
          <p className="text-sm text-muted">Cuenta de Discord</p>
        </div>
      </Card>

      <Card>
        <section aria-labelledby="cuenta-tag" className="flex flex-col gap-3">
          <h2 id="cuenta-tag" className="font-display text-lg">
            Tu perfil de Brawl Stars
          </h2>
          {user.playerTag ? (
            <p className="text-sm text-muted">
              Vinculado a{' '}
              <Link href={profileHref(user.playerTag)} className="font-semibold text-fg underline underline-offset-2">
                #{user.playerTag}
              </Link>
              . Lo ves como &quot;Mi perfil&quot; en el menú de arriba.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Todavía no vinculaste tu tag. Escríbelo aquí o toca &quot;Este soy yo&quot; en tu perfil.
            </p>
          )}
          <LinkTagForm current={user.playerTag} />
        </section>
      </Card>

      <Card>
        <section aria-labelledby="cuenta-sesion" className="flex flex-col gap-3">
          <h2 id="cuenta-sesion" className="font-display text-lg">
            Sesión
          </h2>
          {/* El route handler /auth/logout reenvía a la API, expira la cookie y vuelve a / con 303. */}
          <form method="post" action="/auth/logout">
            <Button type="submit" variant="secondary">
              Cerrar sesión
            </Button>
          </form>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="cuenta-borrar" className="flex flex-col gap-3">
          <h2 id="cuenta-borrar" className="font-display text-lg">
            Borrar cuenta
          </h2>
          <DeleteAccountForm />
        </section>
      </Card>
    </div>
  );
}
