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
- **Graph** : Neo4j 5.19 (ephemerides)
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
│   ├── neo4j/        # Wrapper Neo4j
│   ├── types/        # Types TS partagés
│   └── ui/           # (réservé pour futurs composants partagés)
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
- Postgres 16, Redis 7, Neo4j 5 (ou `docker-compose up postgres redis neo4j` si compose dev fourni)

### Installation

```bash
# 1. Cloner le repo
git clone <repo-url>
cd astro-platform

# 2. Copier les variables d'env
cp .env.example .env.local
# Puis éditer .env.local avec tes vraies valeurs (cf. SECURITY.md)

# 3. Installer les dépendances
pnpm install

# 4. Lancer postgres + redis + neo4j (via compose dev ou local)
# (à adapter selon ton setup)

# 5. Lancer le backend en dev
cd apps/api && pnpm dev

# 6. Dans un autre terminal, lancer le frontend
cd apps/web && pnpm dev
```

L'API tourne sur `http://localhost:4000`, le frontend sur `http://localhost:3000`.

---

## Conventions de patches

Le projet utilise un système de **patches versionnés** pour appliquer des modifications de façon traçable :

- Chaque patch a un nom : `PATCH-FOO-V1`, `ARCHIVE-BAR-V1`, `HOTFIX-BAZ`
- Marker en commentaire à la fin des fichiers modifiés (`// PATCH-FOO-V1 applied`)
- Marker fichier à la racine (`.PATCH-FOO-V1-APPLIED`)
- Idempotence : 2e exécution = no-op
- Backup avec hash SHA256 verify avant chaque modification
- Rollback bit-perfect dispo

Voir le dossier `.archive/` (non commité) pour l'historique des tarballs livrés.

---

## Sécurité

⚠️ **JAMAIS commit `.env.local`** ni aucun fichier contenant des secrets.

Voir [SECURITY.md](./SECURITY.md) pour les conventions complètes.

Si tu suspectes une fuite de secret, suis la procédure de rotation décrite dans SECURITY.md.

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
