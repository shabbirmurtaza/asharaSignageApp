# Setup — Ashara Signage App

Full stack runs in Docker: Postgres + PostgREST + React frontend (nginx).

## Prerequisites

- Docker + Docker Compose v2
- Open ports on host: `3000`, `5432`, `8090` (configurable in `docker-compose.yml`)

## 1. Clone

```bash
git clone <repo-url> asharaSignageApp
cd asharaSignageApp
```

## 2. Environment

Copy example and fill secrets:

```bash
cp .env.example .env
```

Edit `.env`:

```
POSTGRES_DB=ashara
POSTGRES_USER=ashara
POSTGRES_PASSWORD=<strong-password>
AUTHENTICATOR_PASSWORD=<strong-password>   # must match db/01_extensions.sql
JWT_SECRET=<openssl rand -base64 48>       # min 32 chars
```

Generate JWT secret:

```bash
openssl rand -base64 48
```

For non-localhost deployment, set frontend API URL (browser hits PostgREST directly):

```bash
export VITE_POSTGREST_URL=https://api.your-domain.com
```

## 3. Build + Run

```bash
docker compose build
docker compose up -d
```

Verify:

```bash
docker compose ps
curl -I http://localhost:8090           # frontend
curl http://localhost:3000/             # postgrest
```

## 4. Initialize Schema (first time only)

Schema files mounted at `/sql` inside postgres container.

```bash
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/01_extensions.sql
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/schema_v7.sql
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/02_auth_functions.sql
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/03_rls_policies.sql
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/seed_signs.sql
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /sql/seed_bootstrap_admin.sql
```

After schema load, restart PostgREST to pick up new tables:

```bash
docker compose restart postgrest
```

## 5. URLs

| Service    | URL                      |
|------------|--------------------------|
| Frontend   | http://localhost:8090    |
| PostgREST  | http://localhost:3000    |
| Postgres   | localhost:5432           |

## Production Hosting

### Reverse proxy (recommended)

Front the stack with nginx/Caddy/Traefik on the host or a separate container. TLS termination at proxy.

Example route map:
- `https://signage.example.com` → `localhost:8090` (frontend)
- `https://api.signage.example.com` → `localhost:3000` (postgrest)

Rebuild frontend with prod API URL:

```bash
VITE_POSTGREST_URL=https://api.signage.example.com docker compose build web
docker compose up -d web
```

### Bind to localhost only (when behind reverse proxy)

Edit `docker-compose.yml` ports:

```yaml
ports:
  - "127.0.0.1:8090:80"
  - "127.0.0.1:3000:3000"
  - "127.0.0.1:5432:5432"
```

### Backups

Postgres data lives in named volume `asharasignage_pgdata`.

Dump:

```bash
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

## Common Commands

```bash
docker compose up -d                  # start all
docker compose down                   # stop all (volumes preserved)
docker compose down -v                # stop + delete data (DESTRUCTIVE)
docker compose logs -f web            # tail frontend logs
docker compose logs -f postgrest      # tail API logs
docker compose build web              # rebuild frontend after code change
docker compose restart postgrest      # reload after schema change
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

## Port Conflicts

Defaults: `3000`, `5432`, `8090`. To change, edit `ports:` in `docker-compose.yml`:

```yaml
ports:
  - "9090:80"     # frontend on 9090 instead
```

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

If schema changed, re-run relevant SQL from step 4 + `docker compose restart postgrest`.
