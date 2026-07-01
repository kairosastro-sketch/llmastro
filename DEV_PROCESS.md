# Dev process — llmastro V1

Pipeline de développement en **3 étages** : `local → staging (Docker local) → prod`.
Révisé 2026-07-01. Ce document est la source de vérité pour toute session (locale ou cloud).

## Vue d'ensemble

```
① ÉDITER              ② STAGING (Docker local)          ③ PROD
worktree propre   →   stack prod-like en local     →    llmastro.com
off origin/main       (docker compose + start-dev)      (merge main + deploy manuel)
```

Il n'y a **pas** d'environnement de staging distant. Le staging, c'est le stack Docker
qui tourne en local, au plus près de la prod (mêmes images Postgres/Redis).

## ① Éditer

- Toujours dans un **worktree propre basé sur `origin/main`**. Ne jamais coder dans un
  checkout resté en arrière.
- Une branche feature par changement.

## ② Staging = stack Docker local prod-like  (étage de validation obligatoire)

Prérequis : Docker Desktop (WSL2). Dans le worktree :

```
docker compose up -d postgres redis     # postgres:16-alpine + redis:7-alpine (comme la prod)
./start-dev.ps1                          # API :4000 + Web :3000 (détachés)
```

Puis **tester la feature end-to-end** sur cette instance : vraie base, vraies migrations +
DDL de boot, vrai Redis. **Vérification visuelle** dans le navigateur (`127.0.0.1:3000`),
en **viewport mobile** pour les pages mobile-first.

Gates statiques (bloquants en CI — les passer localement d'abord) :

```
corepack pnpm type-check
pnpm lint:ci                             # css-vars + forbidden-classes
```

⚠️ Ne jamais lancer en parallèle les services natifs Postgres/Redis **et** le Docker compose
(conflit sur les ports 5432 / 6379).

## ③ Prod

1. Merge sur `main`.
2. La CI build les images GHCR `:latest` (~5-10 min). Attendre que le job **docker** de la CI
   soit vert (pas seulement CodeQL/Security) avant de déployer.
3. Déploiement **manuel** : workflow `Deploy to Production` (`workflow_dispatch`) → taper
   `deploy` → approbation de l'environnement `production` → VPS.
4. Vérif : `curl https://llmastro.com/api/health` (200) + rendu navigateur.

Pièges opérationnels prod : force-recreate pour les images `:latest`, restart Caddy après
recreate `api` (cache DNS → 502), **jamais** `-f docker-compose.yml` en prod (casse Postgres).

## Notes

- `develop` = branche d'intégration ; la CI y build des images GHCR **non-`:latest`**, mais
  **rien ne les déploie** (aucun environnement distant ne les consomme). Un push sur `develop`
  ne « met pas en staging ».
- Webhooks tiers (Stripe, Meta…) : pas de tunnel local ; pointer l'endpoint du provider vers
  `https://llmastro.com/api/...`, ou tester la logique sans le tiers.
