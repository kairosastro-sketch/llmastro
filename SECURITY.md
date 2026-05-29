# Security Policy

## Conventions secrets

### ⚠️ JAMAIS commit ces fichiers
- `.env`, `.env.local`, `.env.production`, `.env.development` (et toutes leurs variantes)
- Tout fichier contenant `JWT_SECRET=`, `JWT_REFRESH_SECRET=`, `DATABASE_URL=` avec mot de passe en clair, `XAI_API_KEY=`, `ADMIN_API_TOKEN=`, `RESEND_API_KEY=`, `GOOGLE_CLIENT_SECRET=`, `GITHUB_CLIENT_SECRET=`, `S3_SECRET_ACCESS_KEY=`, etc.
- Tout backup `.backup-*` qui pourrait contenir l'état précédent de `.env.local`

### ✅ Toujours commit
- `.env.example` avec **uniquement des placeholders** (jamais de vraies valeurs)
- Cette documentation (`SECURITY.md`)

## Variables sensibles actuelles

| Variable | Type | Où elle vit |
|---|---|---|
| `JWT_SECRET` | 64 chars random | `.env.local` |
| `JWT_REFRESH_SECRET` | 64 chars random | `.env.local` |
| `DATABASE_URL` | Connection string avec password | `.env.local` |
| `XAI_API_KEY` | API key xAI (compte payant) | `.env.local` |
| `ADMIN_API_TOKEN` | 32 chars random | `.env.local` |
| `RESEND_API_KEY` | API key email (futur) | `.env.local` |
| `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET` | OAuth secrets | `.env.local` |
| `S3_SECRET_ACCESS_KEY` | AWS credentials (futur) | `.env.local` |

## Génération de secrets

```bash
# JWT secrets (64 chars base64)
openssl rand -base64 48

# ADMIN_API_TOKEN (32 chars hex)
openssl rand -hex 16

# Mot de passe DB
openssl rand -base64 24
```

## Si un secret a été commité par erreur

### 1. **Le retirer immédiatement de l'historique**
```bash
# Si c'est le DERNIER commit (pas encore push)
git reset --soft HEAD~1
git restore --staged .
# Édite/supprime le fichier en question
git commit -m "..."

# Si c'est un commit déjà pushé
# → utilise BFG Repo-Cleaner ou git-filter-repo
# → MAIS le secret est compromis, il FAUT le rotater aussi
```

### 2. **Rotater le secret** (obligatoire si déjà push)

Le simple fait que le secret soit apparu dans un commit Git, même retiré ensuite, signifie qu'il faut le considérer comme compromis. Quelqu'un peut l'avoir vu, cloné, indexé.

**Procédure de rotation par variable** :

#### `JWT_SECRET` / `JWT_REFRESH_SECRET`
```bash
# Générer nouvelle valeur
openssl rand -base64 48
# Remplacer dans .env.local
# Redéployer api → tous les tokens existants seront invalidés
# (les users devront se reconnecter)
```

#### `DATABASE_URL` (mot de passe Postgres)
```bash
# Sur le VPS
docker compose exec postgres psql -U astro -d postgres
> ALTER USER astro WITH PASSWORD 'nouveau-secret';
> \q
# Mettre à jour DATABASE_URL dans .env.local
# Redéployer api
```

#### `XAI_API_KEY`
```bash
# Sur https://x.ai → revoke ancienne clé + générer nouvelle
# Mettre à jour .env.local
# Redéployer api
```

#### `ADMIN_API_TOKEN`
```bash
openssl rand -hex 16
# Mettre à jour .env.local
# Redéployer api
```

## Audit régulier

Avant chaque push, vérifier qu'aucun secret n'a fuité :

```bash
# Cherche les patterns connus dans les fichiers staged
git diff --cached | grep -iE 'JWT_(SECRET|REFRESH)=|API_KEY=[a-zA-Z0-9]{10,}|PASSWORD=[a-zA-Z0-9]+|TOKEN=[a-zA-Z0-9]{20,}'

# Si quelque chose remonte, NE PAS COMMIT
```

Le script `safety-check.sh` (livré avec ARCHIVE-GITHUB-SETUP) automatise ce check.

## Reporting

Pour signaler une vulnérabilité ou une fuite de secret : envoyer un email à `info@llmastro.com`.
