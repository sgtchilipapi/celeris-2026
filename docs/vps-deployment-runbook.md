# VPS Deployment Runbook

This is the deployment path used to host the Celeris demo stack on a single VM.

The stack is:

- Caddy on ports `80` and `443`
- Next.js web app on `127.0.0.1:3101`
- Express API on `127.0.0.1:4100`
- Postgres in Docker on `127.0.0.1:5432`
- Mysten zkLogin prover in Docker on `127.0.0.1:9000`
- PM2 supervising the API and web app

## VM Setup

Use a VM with at least 4 GB RAM. A smaller 848 MiB VPS was not enough; `npm ci` was killed by the OOM killer.

Install Docker, Node, and PM2:

```sh
sudo apt update
sudo apt install -y git curl ca-certificates lsof gnupg git-lfs caddy

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out and back in so Docker group permissions apply.

Install Node 22 through `nvm`:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
npm i -g npm@11.11.0 pm2
git lfs install
```

## Initial Deploy

```sh
git clone <repo-url> ~/celeris-2026
cd ~/celeris-2026
npm ci --no-audit --no-fund

cp .env.example .env.local
cp .env.demo.example .env.demo
```

Set production origins in `.env.local`:

```env
CELERIS_PUBLIC_SITE_ORIGIN=https://celeris.pro
API_ORIGIN=https://api.celeris.pro
CELERIS_DEVELOPER_APP_ORIGIN=https://app.celeris.pro
CELERIS_DEMO_FRONTEND_ORIGIN=https://demo.celeris.pro
CELERIS_HOSTED_AUTH_ORIGIN=https://auth.celeris.pro
CELERIS_GOOGLE_REDIRECT_URI=https://api.celeris.pro/v1/auth/google/callback
DATABASE_URL=postgresql://celeris:celeris@127.0.0.1:5432/celeris?schema=public

NEXT_PUBLIC_SITE_ORIGIN=https://celeris.pro
NEXT_PUBLIC_API_ORIGIN=https://api.celeris.pro
NEXT_PUBLIC_DEVELOPER_APP_ORIGIN=https://app.celeris.pro
NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN=https://demo.celeris.pro
NEXT_PUBLIC_HOSTED_AUTH_ORIGIN=https://auth.celeris.pro
```

Set demo values in `.env.demo`:

```env
NEXT_PUBLIC_DEMO_APP_ID=<app-id-from-this-vm-database>
HELLO_CELERIS_PACKAGE_ID=<published-package-id>
HELLO_CELERIS_APP_STATE_OBJECT_ID=<app-state-object-id>
```

Load env and build:

```sh
set -a
. ./.env.local
. ./.env.demo
set +a

npm run build
```

Start Postgres and apply migrations:

```sh
docker compose -f docker-compose.dev.yml up -d postgres
npm run prisma:generate
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

## zkLogin Prover

The prover needs a real zkey file. If Docker starts before the file exists, Docker may create a directory at the mount path, which causes the backend prover to segfault.

Correct setup:

```sh
cd ~/celeris-2026
sudo chown -R $USER:$USER .zklogin || true
sudo rm -rf .zklogin/zklogin-ceremony-contributions/zkLogin-main.zkey

mkdir -p .zklogin
cd .zklogin
wget -O download-main-zkey.sh https://raw.githubusercontent.com/sui-foundation/zklogin-ceremony-contributions/main/download-main-zkey.sh
bash download-main-zkey.sh
cd ..

ls -lh .zklogin/zklogin-ceremony-contributions/zkLogin-main.zkey
```

The zkey should be a large file, around hundreds of MB, and the `ls` output should start with `-rw-`, not `drwx`.

Start the prover:

```sh
export ZKLOGIN_ZKEY_PATH="$PWD/.zklogin/zklogin-ceremony-contributions/zkLogin-main.zkey"
docker compose -f docker-compose.zklogin.yml up -d --force-recreate
curl http://localhost:9000/ping
```

Expected:

```text
pong
```

If Google sign-in fails with `zkLogin prover rejected the Google identity` and logs show `getaddrinfo ENOTFOUND zklogin-prover-backend`, check whether the backend is running:

```sh
docker ps
docker compose -f docker-compose.zklogin.yml logs --tail=120
```

If logs show `Segmentation fault` and `/app/binaries/zkLogin.zkey` is a directory, redo the zkey setup above.

## PM2

Start the API and web app:

```sh
set -a
. ./.env.local
. ./.env.demo
set +a

PORT=4100 pm2 start "npm run start:api" --name celeris-api
PORT=3101 pm2 start "npm run start:web" --name celeris-web
pm2 save
```

Set PM2 to restart on VM boot:

```sh
pm2 startup
```

Run the `sudo env ... pm2 startup systemd -u <user> --hp <home>` command printed by PM2, then:

```sh
pm2 save
systemctl is-enabled pm2-$USER
pm2 status
```

## Caddy

Use this Caddyfile:

```caddy
{
        email you@example.com
}

celeris.pro {
        reverse_proxy 127.0.0.1:3101
}

www.celeris.pro {
        redir https://celeris.pro{uri} permanent
}

api.celeris.pro {
        reverse_proxy 127.0.0.1:4100
}

app.celeris.pro, demo.celeris.pro, auth.celeris.pro {
        reverse_proxy 127.0.0.1:3101
}
```

Apply it:

```sh
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

DNS records should point to the VM public IP:

```text
A  @     <VM_PUBLIC_IP>
A  www   <VM_PUBLIC_IP>
A  api   <VM_PUBLIC_IP>
A  app   <VM_PUBLIC_IP>
A  auth  <VM_PUBLIC_IP>
A  demo  <VM_PUBLIC_IP>
```

On Google Cloud, ensure inbound TCP `80` and `443` are allowed.

Cloudflare notes:

- `522` usually means Cloudflare cannot reach the VM. Check firewall and DNS.
- `525` usually means Cloudflare can reach Caddy but TLS is failing. Temporarily set records to DNS only, let Caddy issue certs, then switch back to proxied with SSL/TLS mode `Full (strict)`.

## Health Checks

```sh
curl https://api.celeris.pro/health
curl -I https://celeris.pro
curl -I https://app.celeris.pro
curl -I https://demo.celeris.pro
curl -I https://auth.celeris.pro

pm2 status
docker ps
sudo systemctl is-active caddy
```

The API health route is `/health`, not `/v1/health`.

`/health/diagnostics` currently probes the zkLogin origin root and may report `HTTP 404` even when `http://localhost:9000/ping` returns `pong`.

## Restart Persistence

Check PM2 and Docker restart settings:

```sh
pm2 status
systemctl is-enabled pm2-$USER
sudo systemctl is-enabled caddy

docker inspect celeris-dev-postgres --format '{{.HostConfig.RestartPolicy.Name}}'
docker inspect celeris-2026-zklogin-prover-backend-1 --format '{{.HostConfig.RestartPolicy.Name}}'
docker inspect celeris-2026-zklogin-prover-frontend-1 --format '{{.HostConfig.RestartPolicy.Name}}'
```

Docker services should use:

```text
unless-stopped
```

If the zkLogin compose file does not have restart policies, add `restart: unless-stopped` under both prover services and apply:

```sh
export ZKLOGIN_ZKEY_PATH="$PWD/.zklogin/zklogin-ceremony-contributions/zkLogin-main.zkey"
docker compose -f docker-compose.zklogin.yml up -d
```

## Deploying Future Changes

For normal frontend/API changes:

```sh
cd ~/celeris-2026
git pull origin main

set -a
. ./.env.local
. ./.env.demo
set +a

npm run build
pm2 restart celeris-api celeris-web --update-env
pm2 save
```

For demo branding-only changes:

```sh
cd ~/celeris-2026
git pull origin main

set -a
. ./.env.local
. ./.env.demo
set +a

npm run build
pm2 restart celeris-web --update-env
pm2 save
```

Run `npm ci --no-audit --no-fund` only when dependencies or the lockfile changed.

Run Prisma migrations only when schema/migrations changed:

```sh
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

## Issues Encountered

- `npm ci` was killed on an 848 MiB VPS. Use 4 GB RAM or add swap.
- `docker-compose-plugin` was missing from Debian repos. Use Docker's official Debian repository.
- The API initially crashed in production because internal workspace packages exported `src/*.ts` instead of `dist/*.js`.
- The demo frontend had a hardcoded app ID; it now uses `NEXT_PUBLIC_DEMO_APP_ID`.
- Caddy was correctly running even when Cloudflare returned `522` or `525`; those were DNS/firewall/TLS mode issues.
- The zkLogin zkey path became a directory when Docker started before the zkey file existed. Remove it, install Git LFS, download the real zkey, and recreate the prover containers.
