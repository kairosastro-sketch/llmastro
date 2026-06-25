# Runbook — A1 (full API) : auto-publication serveur du « ciel du jour »

Publier **chaque jour, sans geste manuel**, le post image « ciel du jour » sur
**Instagram + Pinterest**, **directement depuis le VPS** via les API officielles.
Remplace le flux semi-auto Metricool (`RUNBOOK-AUTOPOST-A1.md`).

> Code : `daily-post.mjs` (génération, déjà en place) + `publish.mjs` (publication, nouveau).
> Cron VPS : `daily-post.mjs` puis `publish.mjs` (= `npm run post`).

---

## Vue d'ensemble du flux

```
cron 07:30 (VPS)
  └─ node daily-post.mjs        → out/<date>/ciel-day-<date>.png + caption-day.txt + sky-day.json
  └─ node publish.mjs
        ├─ PNG → JPEG (sharp)    (Instagram refuse le PNG)
        ├─ Instagram : POST /media (image_url public) → poll status → /media_publish
        └─ Pinterest : POST /v5/pins (image base64, pas d'URL publique requise)
Caddy sert out/ en HTTPS public → https://llmastro.com/social/<date>/ciel-day-<date>.jpg  (pour Instagram)
Échec → e-mail Resend (info@llmastro.com → toi)
```

---

## Étape 0 — Prérequis comptes (UNE fois) ⚠️ bloquant

- [ ] **Instagram en compte Pro** (Business ou Créateur) — gratuit, réversible.
      ⚠️ **Aucune Page Facebook n'est nécessaire** (chemin « Instagram login »).
- [ ] **Pinterest en compte Business** — gratuit. Créer le tableau **« Ciel du jour »**.

---

## Étape 1 — App Meta (Instagram) ⚠️ chemin critique, à lancer EN PREMIER

L'App Review Meta prend **plusieurs jours à quelques semaines** : démarre-la avant tout le reste.

1. [ ] developers.facebook.com → **Créer une app** → type **Business**.
2. [ ] Ajouter le produit **« Instagram » → API setup with Instagram login**
       (PAS « with Facebook login »).
3. [ ] Demander les permissions en **Accès Avancé** :
       `instagram_business_basic`, `instagram_business_content_publish`.
       → déclenche l'**App Review** (capture d'écran + vidéo du flux de publication à fournir).
4. [ ] Faire le **Business Login for Instagram** une fois pour récupérer :
       - l'**IG_USER_ID** (id du compte pro, via `GET /me`)
       - un **token utilisateur Instagram long-lived (60 j)** → `IG_ACCESS_TOKEN`.
       (Échange short-lived → long-lived : `GET graph.instagram.com/access_token?grant_type=ig_exchange_token`.)

> `publish.mjs` rafraîchit ensuite ce token tout seul (à >50 j) ; aucune action récurrente.

---

## Étape 2 — App Pinterest

1. [ ] developers.pinterest.com → **Créer une app** (compte Business).
2. [ ] Scopes : **`pins:write`** (+ `boards:read`). En **trial access**, on peut déjà
       publier sur **son propre compte** — suffisant ici ; demander le standard access seulement si besoin.
3. [ ] OAuth une fois → récupérer **`PINTEREST_ACCESS_TOKEN`** + **`PINTEREST_REFRESH_TOKEN`**,
       et l'**`PINTEREST_BOARD_ID`** du tableau « Ciel du jour » (via `GET /v5/boards`).
4. [ ] Noter **APP_ID** + **APP_SECRET** (servent au refresh automatique).

---

## Étape 3 — Servir les images en HTTPS public (pour Instagram)

Instagram télécharge l'image via cURL depuis une URL publique. Caddy tourne **en container**,
on monte donc `scripts/social/out` dans le container et on le sert sous `/social/*`.
**Les deux modifs ci-dessous sont déjà appliquées dans le repo** (`SOCIAL-AUTOPOST-API-A1`) :

1. `caddy/Caddyfile`, sous le site `llmastro.com`, après le `handle_path /api/*` :

```caddy
handle_path /social/* {
root * /srv/social
file_server
}
```

2. `docker-compose.prod.yml`, service `caddy`, dans `volumes:` :

```yaml
- ./scripts/social/out:/srv/social:ro
```

Déploiement sur le VPS :

```bash
cd /opt/astro-platform
git pull origin main
mkdir -p scripts/social/out                    # le dossier doit exister avant le mount (out/ est gitignoré)
docker compose -f docker-compose.prod.yml up -d caddy   # recrée le container (nouveau volume)
# (Une simple modif ULTÉRIEURE du Caddyfile, sans toucher au volume, requiert :
#  docker restart astro-platform-caddy-1  — bind-mount fichier unique, le reload ne suffit pas.)
curl -I https://llmastro.com/social/<date>/ciel-day-<date>.jpg   # attendu : 200 + Content-Type image/jpeg
```

> ⚠️ Vérifier d'abord que le `Caddyfile` du VPS n'a pas divergé (éditions directes passées) :
> `git -C /opt/astro-platform status caddy/Caddyfile` doit être propre avant le `git pull`.

---

## Étape 4 — Config serveur

```bash
cd /opt/astro-platform/scripts/social
cp .env.example .env        # puis remplir (tokens des étapes 1-2) — .env est gitignoré
npm install                 # @resvg/resvg-js + sharp (builds Linux)
sudo apt-get install -y fonts-dejavu-core   # police des glyphes ☉☽♀♈ (vérifié : couvre les 23)
```

> ✅ **Port Linux du générateur : FAIT dans le code.** `daily-post.mjs` détecte la plateforme
> (`process.platform`) et bascule automatiquement Segoe UI → **DejaVu Sans** (familles SVG +
> `fontFiles` adaptés ; Noto Sans Symbols 2 ajouté en repli s'il est présent). DejaVu Sans seul
> couvre **les 23 glyphes** (10 planètes + Nœud Nord + 12 signes) — testé via resvg. Donc
> `fonts-dejavu-core` suffit. Override possible : `SOCIAL_FONT_FILES="/chemin/a.ttf,/chemin/b.ttf"`.
> Si un jour un glyphe manque malgré tout : `sudo apt-get install -y fonts-noto-core`.

---

## Étape 5 — Test à blanc puis activation

```bash
node daily-post.mjs                 # génère le post du jour
node publish.mjs --dry-run          # convertit, prépare captions + URL, SANS publier
node publish.mjs --only pinterest   # 1er vrai post sur le réseau le moins risqué
node publish.mjs                     # les deux réseaux
```

Cron (après validation) :

```bash
# crontab -e  (heure VPS ; ajuster si UTC vs Europe/Paris)
30 7 * * *  cd /opt/astro-platform/scripts/social && /usr/bin/node daily-post.mjs && /usr/bin/node publish.mjs >> /var/log/llmastro-social.log 2>&1
```

---

## Exploitation

- **Échec** → e-mail automatique (Resend). Causes fréquentes : IG repassé en perso,
  token Pinterest expiré non rafraîchi (rare, géré sur 401), URL `/social/*` non servie (Caddy).
- **Tokens** : persistés dans `.tokens.json` (gitignoré), rafraîchis automatiquement.
  Si tout casse : régénérer `IG_ACCESS_TOKEN` (Étape 1.4), supprimer `.tokens.json`, relancer.
- **X / TikTok** : hors périmètre de ce runbook (X = planificateur natif ; TikTok = Metricool/vidéo).

---

## Valeurs à reconfirmer dans les dashboards (non devinables)

| Variable | Où la trouver |
|---|---|
| `IG_USER_ID` | `GET /me` après Business Login Instagram |
| `IG_ACCESS_TOKEN` | échange short→long-lived, 60 j |
| `IG_GRAPH_VERSION` | version courante affichée par l'app Meta (doc actuelle : v25.x) |
| `PINTEREST_BOARD_ID` | `GET /v5/boards` |
| scopes Pinterest | écran OAuth de l'app (doit inclure `pins:write`) |
