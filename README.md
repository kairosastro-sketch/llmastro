# Llmastro

Plateforme d'astrologie en français : thème natal détaillé, horoscopes personnalisés, synastrie, tarot.

> *« Ton vrai thème, pas un horoscope générique. »*

**Production** : [https://llmastro.com](https://llmastro.com) (auth-protected)

---

## Stack

- **Monorepo** : pnpm workspaces (`apps/`, `packages/`)
- **Backend** : Fastify 4 + Drizzle ORM + Postgres 16 (port 4000)
- **Frontend** : Next.js 14 App Router (port 3000)
- **Cache** : Redis 7 (AOF, 256 Mo, LRU)
- **IA** : xAI Grok via service `Kairos` interne
- **Calculs astro** : Swiss Ephemeris + lib custom Meeus (tables JPL NASA)
- **Auth** : JWT access 15 min + refresh cookie + OAuth Google/GitHub
- **Reverse proxy** : Caddy 2 + Let's Encrypt
- **Déploiement** : Docker Compose (`docker-compose.prod.yml`) sur VPS Ubuntu 24.04

---

## Architecture du repo

```
.
├── apps/
│   ├── api/          # Backend Fastify
│   └── web/          # Frontend Next.js
├── packages/
│   ├── ephemeris/    # Service de calculs astronomiques (Swiss Ephemeris)
│   └── types/        # Types TS partagés
├── docker/           # Dockerfiles api + web
├── caddy/            # Caddyfile reverse proxy
├── scripts/          # Scripts dev (dev.sh)
└── docker-compose.prod.yml
```

---

## Quick start (développement local)

### Prérequis

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm@9`)
- Docker + Docker Compose v2
- Postgres 16, Redis 7 (ou `docker-compose up postgres redis` si compose dev fourni)

### Installation

```bash
# 1. Cloner le repo
git clone <repo-url>
cd astro-platform

# 2. Configurer les variables d'env
cp .env.example .env.local

# 3. Installer les dépendances
pnpm install

# 4. Lancer postgres + redis
docker compose up -d postgres redis

# 5. Lancer le backend
cd apps/api && pnpm dev

# 6. Dans un autre terminal, lancer le frontend
cd apps/web && pnpm dev
```

L'API tourne sur `http://localhost:4000`, le frontend sur `http://localhost:3000`.

---

## Déploiement production

Production tourne sur VPS Ubuntu via Docker Compose :

```bash
ssh astro@<vps-ip>
cd /opt/astro-platform
docker compose -f docker-compose.prod.yml up -d --build
```

HTTPS géré par Caddy avec Let's Encrypt (renouvellement auto).

---

## Licence

Privée — tous droits réservés.

© 2026 Llmastro
