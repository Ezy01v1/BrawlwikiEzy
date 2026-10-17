# Deploy en un VPS

Pensado para Ubuntu 24.04 con Node 24, Nginx, PM2 y (opcional) Redis. Todo corre en el mismo servidor: Nginx en los puertos 80/443, Next en `127.0.0.1:3000` y la API en `127.0.0.1:4000`.

## 1. Key de Supercell

La key de https://developer.brawlstars.com está atada a una IP. Crear una **nueva** key con la IP pública del VPS (`curl -4 ifconfig.me`). La key de desarrollo no sirve ahí.

## 2. Servidor

```bash
# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs nginx redis-server certbot python3-certbot-nginx
sudo npm install -g pm2
```

## 3. Código y build

```bash
git clone https://github.com/Ezy01v1/BrawlwikiEzy.git ~/brawlwiki
cd ~/brawlwiki
npm ci
cp apps/api/.env.example apps/api/.env   # pegar SUPERCELL_API_KEY y REDIS_URL=redis://127.0.0.1:6379
NEXT_PUBLIC_SITE_URL=https://brawlwiki.example.com API_INTERNAL_URL=http://127.0.0.1:4000/api/v1 \
  npm run build -w @brawlwiki/web
```

`NEXT_PUBLIC_SITE_URL` se fija en el build: si cambia el dominio, hay que volver a compilar.

## 4. Procesos

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # imprime un comando con sudo: correrlo para que PM2 arranque con el sistema
curl -s http://127.0.0.1:4000/api/v1/health
```

`/health` debe decir `"supercell":"ok"`. Si dice `"unauthorized"`, la key no corresponde a la IP del VPS (se entera recién con la primera consulta real; probar antes con `curl http://127.0.0.1:4000/api/v1/events/rotation`).

## 5. Nginx y HTTPS

```bash
sudo cp deploy/nginx/brawlwiki.conf /etc/nginx/sites-available/brawlwiki
sudo sed -i 's/brawlwiki.example.com/TU_DOMINIO/g' /etc/nginx/sites-available/brawlwiki
sudo ln -s /etc/nginx/sites-available/brawlwiki /etc/nginx/sites-enabled/
sudo certbot certonly --webroot -w /var/www/certbot -d TU_DOMINIO   # antes: comentar el bloque 443 y recargar
sudo nginx -t && sudo systemctl reload nginx
```

## Actualizar

```bash
cd ~/brawlwiki && git pull && npm ci
NEXT_PUBLIC_SITE_URL=https://TU_DOMINIO API_INTERNAL_URL=http://127.0.0.1:4000/api/v1 npm run build -w @brawlwiki/web
pm2 reload ecosystem.config.cjs
```
