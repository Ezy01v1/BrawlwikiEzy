# Deploy en un VPS

Pensado para Ubuntu 24.04 con Node 24, Nginx, PM2, MySQL 8 y (opcional) Redis. Todo corre en el mismo servidor: Nginx en los puertos 80/443, Next en `127.0.0.1:3000`, la API en `127.0.0.1:4000` y MySQL en `127.0.0.1:3306`.

MySQL solo lo usa Comunidad (cuentas con Discord, favoritos en la cuenta y la tier list). Sin `DATABASE_URL` la API corre como la v1 y la web oculta el login; si MySQL se cae, solo se cae Comunidad.

## 1. Key de Supercell

La key de https://developer.brawlstars.com está atada a una IP. Crear una **nueva** key con la IP pública del VPS (`curl -4 ifconfig.me`). La key de desarrollo no sirve ahí.

## 2. Servidor

```bash
# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs nginx redis-server mysql-server certbot python3-certbot-nginx
sudo npm install -g pm2
```

## 3. MySQL

```bash
sudo mysql_secure_installation   # sin usuarios anónimos ni login remoto de root
sudo mysql
```

```sql
CREATE DATABASE brawlwiki CHARACTER SET utf8mb4;
CREATE USER 'brawlwiki'@'localhost' IDENTIFIED BY 'UNA_CONTRASEÑA_LARGA';
GRANT ALL ON brawlwiki.* TO 'brawlwiki'@'localhost';
```

- El usuario `brawlwiki` solo tiene permisos sobre la base `brawlwiki`: la API no usa root.
- La contraseña la elige quien opera el servidor y vive solo en `apps/api/.env` y en el archivo de backups (sección 8). Nunca en el repo. Si lleva caracteres como `@`, `:`, `/` o `#`, en `DATABASE_URL` van escapados en formato URL (`@` → `%40`).
- En Ubuntu MySQL escucha solo en `127.0.0.1` (`bind-address`): el puerto 3306 no se abre en el firewall.

## 4. App de Discord

1. En https://discord.com/developers/applications → **New Application** (el nombre es el que ve la gente al entrar).
2. **OAuth2** → copiar el **Client ID** y, con **Reset Secret**, el **Client Secret**.
3. **OAuth2 → Redirects** → agregar `https://TU_DOMINIO/auth/discord/callback` (exacto, con `https`) y guardar.

La API pide solo el scope `identify` (id, nombre y avatar; no el email). Para ser admin hace falta el id de tu cuenta de Discord: en Discord, Ajustes → Avanzado → **Modo desarrollador**, y después clic derecho en tu usuario → **Copiar ID de usuario**.

## 5. Código y build

```bash
git clone https://github.com/Ezy01v1/BrawlwikiEzy.git ~/brawlwiki
cd ~/brawlwiki
npm ci
cp apps/api/.env.example apps/api/.env
chmod 600 apps/api/.env
```

En `apps/api/.env` (las demás variables quedan como en el ejemplo):

```bash
SUPERCELL_API_KEY=...                       # la key de la sección 1
REDIS_URL=redis://127.0.0.1:6379
DATABASE_URL=mysql://brawlwiki:UNA_CONTRASEÑA_LARGA@127.0.0.1:3306/brawlwiki
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
PUBLIC_SITE_URL=https://TU_DOMINIO         # obligatoria y https; arma el redirect de Discord y es el único Origin aceptado
ADMIN_DISCORD_IDS=123456789012345678       # ids de Discord de los admins, separados por coma
```

**Nunca** `AUTH_MOCK=1` en producción: es un login falso sin Discord. La API se niega a arrancar si lo ve junto con `NODE_ENV=production` (PM2 lo fija en `ecosystem.config.cjs`). Con `DATABASE_URL` y sin `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` tampoco arranca.

```bash
npm run db:migrate -w @brawlwiki/api        # crea las tablas en la base brawlwiki
NEXT_PUBLIC_SITE_URL=https://TU_DOMINIO API_INTERNAL_URL=http://127.0.0.1:4000/api/v1 \
  npm run build -w @brawlwiki/web
```

`NEXT_PUBLIC_SITE_URL` se fija en el build: si cambia el dominio, hay que volver a compilar. Tiene que ser el mismo dominio que `PUBLIC_SITE_URL`; si no, la API responde 403 a las acciones (guardar favoritos, votar, cerrar sesión).

## 6. Procesos

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # imprime un comando con sudo: correrlo para que PM2 arranque con el sistema
curl -s http://127.0.0.1:4000/api/v1/health
```

`/health` debe decir `"supercell":"ok"`. Si dice `"unauthorized"`, la key no corresponde a la IP del VPS (se entera recién con la primera consulta real; probar antes con `curl http://127.0.0.1:4000/api/v1/events/rotation`).

## 7. Nginx y HTTPS

```bash
sudo cp deploy/nginx/brawlwiki.conf /etc/nginx/sites-available/brawlwiki
sudo sed -i 's/brawlwiki.example.com/TU_DOMINIO/g' /etc/nginx/sites-available/brawlwiki
sudo ln -s /etc/nginx/sites-available/brawlwiki /etc/nginx/sites-enabled/
sudo certbot certonly --webroot -w /var/www/certbot -d TU_DOMINIO   # antes: comentar el bloque 443 y recargar
sudo nginx -t && sudo systemctl reload nginx
```

Nginx tiene que pasarle a Next el `Host` original (`proxy_set_header Host $host` y `X-Forwarded-Host $host`, ya en `brawlwiki.conf`): las Server Actions comparan el `Origin` del navegador con ese host y, si no coinciden, no se ejecutan. Con el `Host` de `proxy_pass` (`127.0.0.1:3000`) fallarían todas las acciones de Comunidad.

Para probar el login: entrar a `https://TU_DOMINIO`, tocar "Entrar" y autorizar en Discord. Con tu id en `ADMIN_DISCORD_IDS`, abrir la primera temporada en `https://TU_DOMINIO/admin`.

## 8. Backup diario de MySQL

Un `mysqldump` por día con cron y 7 días de retención. La contraseña va en un archivo que solo lee tu usuario, no en la línea de comandos (ahí la vería cualquiera con `ps`).

```bash
cat > ~/.brawlwiki-backup.cnf <<'EOF'
[client]
user=brawlwiki
password=UNA_CONTRASEÑA_LARGA
EOF
chmod 600 ~/.brawlwiki-backup.cnf

mkdir -p ~/bin ~/backups/mysql
cat > ~/bin/brawlwiki-backup.sh <<'EOF'
#!/usr/bin/env bash
# Backup diario de la base brawlwiki: un .sql.gz por día y se borran los de más de 7 días.
set -euo pipefail
dir="$HOME/backups/mysql"
file="$dir/brawlwiki-$(date +%F).sql.gz"
# --single-transaction: copia consistente sin bloquear las tablas InnoDB.
# --no-tablespaces: el usuario brawlwiki no tiene el permiso global PROCESS.
mysqldump --defaults-extra-file="$HOME/.brawlwiki-backup.cnf" \
  --single-transaction --no-tablespaces brawlwiki | gzip > "$file.tmp"
mv "$file.tmp" "$file"
find "$dir" -name 'brawlwiki-*.sql.gz' -mtime +6 -delete
EOF
chmod 700 ~/bin/brawlwiki-backup.sh
~/bin/brawlwiki-backup.sh && ls -lh ~/backups/mysql   # probarlo una vez a mano
```

Con `crontab -e` (a las 4:15 todos los días; `$HOME` lo pone cron):

```
15 4 * * * $HOME/bin/brawlwiki-backup.sh >> $HOME/backups/mysql/backup.log 2>&1
```

Los backups quedan en el mismo VPS: si el disco se pierde, se pierden con él. Conviene copiarlos de vez en cuando a otra máquina (por ejemplo, con `scp` o `rsync`).

### Restaurar un backup

```bash
pm2 stop brawlwiki-api
gunzip -c ~/backups/mysql/brawlwiki-AAAA-MM-DD.sql.gz \
  | mysql --defaults-extra-file="$HOME/.brawlwiki-backup.cnf" brawlwiki
cd ~/brawlwiki && npm run db:migrate -w @brawlwiki/api   # si el código es más nuevo que el backup
pm2 start brawlwiki-api
```

El dump reemplaza cada tabla (incluida la de migraciones aplicadas, `__drizzle_migrations`), así que la base vuelve exactamente al estado de ese día: lo que se guardó después se pierde. Las sesiones también vuelven a ese día.

## Actualizar

```bash
cd ~/brawlwiki && git pull && npm ci
npm run db:migrate -w @brawlwiki/api        # SIEMPRE antes de recargar: el código nuevo puede esperar tablas nuevas
NEXT_PUBLIC_SITE_URL=https://TU_DOMINIO API_INTERNAL_URL=http://127.0.0.1:4000/api/v1 npm run build -w @brawlwiki/web
pm2 reload ecosystem.config.cjs
```
