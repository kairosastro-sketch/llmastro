# Notifications System — Session Handoff

**Date** : 2026-05-09
**Phase 1** : Complète et déployée en prod
**URL prod** : https://llmastro.com

---

## Ce qui est livré (16 PRs mergées)

| PR | Phase | Description |
|---|---|---|
| #1-3 | 1A | Foundation — DB schema (`notifications`, `users.preferences`), types, routes squelettes |
| #4 | 1B | Sky events — détection lunations + éclipses sur fenêtre 7 jours |
| #6-9 | 1C | Personalization — `event-relevance.service` (scoring) + `Kairos` LLM (xAI) génère un texte perso par event×user |
| #10 | 1D | Dispatcher — boot task `startNotificationDispatcher`, run immédiat + scheduler 6h |
| #11 | fix | Schema bootstrap : `ensureNotificationsSchema()` inline le SQL de `0009_notifications.sql` (cause de l'incident `column "preferences" does not exist`) |
| #12 | 1E | UI bell + drawer (mobile-first, 380px slide depuis la droite) |
| #13 | fix | Drawer via `createPortal` (les ancêtres avec `backdrop-filter` capturaient le `position: fixed`) |
| #14 | fix | Types frontend alignés sur la vraie shape backend (`event` raw + `kairosText`, pas `{ title: { fr, en } }`) |
| #15 | fix | `dedup_key` tronqué à `YYYY-MM-DD` (la recherche binaire pour `event.date` n'est pas déterministe ms-précis) + migration data one-shot |
| #16 | polish | Titre enrichi avec signe zodiacal ("Pleine Lune en Capricorne") + click notif = mark read + close drawer + nav vers `/dashboard/horoscope` |
| #17 | 1F | Préférences UI (page `/dashboard/notifications/preferences` avec 4 sections) + `PATCH /notifications/mark-all-read` + bouton "Tout marquer lu" + lien prefs dans le drawer |

---

## Architecture en bref

### Backend (`apps/api`)

**Boot order** (`src/index.ts:163-180`) :

```
runMigrations()                  → tables historiques (users, natal_data, ...)
initSchemaCoherence()            → colonnes manquantes idempotentes
initAdminFlag/StatsTables/...
ensureNotificationsSchema()      → crée table notifications + ALTER users.preferences
normalizeDedupKeysToDay()        → migration one-shot dedup_key (idempotente, ne fait rien si déjà fait)
startNotificationDispatcher()    → run immédiat puis setInterval 6h
```

**Routes** (préfix `/notifications`, toutes auth) :

| Route | Description |
|---|---|
| `GET    /` | Liste paginée. Returns `{ items, nextCursor, unreadCount }` |
| `PATCH  /:id/read` | Mark single |
| `PATCH  /mark-all-read` | Mark all (Phase 1F) |
| `GET    /preferences` | Returns `ResolvedUserPreferences` (defaults appliqués) |
| `PATCH  /preferences` | Patch partiel, deep merge serveur |

**Services clés** :
- `notification-dispatcher.service.ts` : pour chaque user × event × natal, calcule relevance, génère kairosText, INSERT IF NEW
- `event-relevance.service.ts` : scoring + `buildSkyEventDedupKey(event)` → `sky_event:lunation:full:2026-05-12` (jour-tronqué)
- `sky-events.service.ts` : détection lunations/éclipses sur fenêtre 7j
- `notifications.service.ts` : CRUD + `markAllAsRead`

### Frontend (`apps/web`)

**Composants** :
- `components/notifications/NotificationBell.tsx` — bouton + badge unread
- `components/notifications/NotificationsPanel.tsx` — drawer **rendu via `createPortal`** (cf. gotcha #2 plus bas)
- `components/notifications/NotificationItem.tsx` — item liste, dérive titre depuis `event.phase` + `event.sign`
- `app/dashboard/notifications/preferences/page.tsx` — page settings 4 sections

**Hooks** (`hooks/useNotifications.ts`) :
- `useNotificationsList()` — query, poll 60s, key `["notifications"]`
- `useMarkNotificationRead()` — mutation optimistic
- `useMarkAllNotificationsRead()` — mutation optimistic
- `useNotificationPreferences()` — query, staleTime 5min, key `["notifications", "prefs"]`
- `useUpdateNotificationPreferences()` — mutation optimistic avec deep merge sur `notify_events`

**API helpers** (`lib/api/notifications.ts`) :
- `notificationsApi.{ list, markRead, markAllRead, getPrefs, updatePrefs }`
- Types : `NotificationData = SkyEventNotificationData | SystemNotificationData`, `ResolvedUserPreferences`, `LunationEvent`, `EclipseEvent`, `ZODIAC_SIGN_LABELS`

---

## Gotchas appris (lis avant de toucher au code)

### 1. Pas de `runMigrations` qui lit les `.sql` — pattern projet inline

`runMigrations` dans `db/index.ts` n'est PAS un loader de fichiers. C'est une fonction qui inline le SQL des tables historiques (users, natal_data, refresh_tokens). Les fichiers `apps/api/src/db/migrations/*.sql` sont **uniquement** une trace historique, jamais lus à l'exécution.

**Convention** : chaque migration = un boot task `init-X.ts` qui inline le SQL en `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Cf. `init-readings.ts`, `init-schema-coherence.ts`, `ensureNotificationsSchema()`.

Ne jamais committer un `.sql` sans son boot task miroir, sinon la migration ne s'applique JAMAIS en prod (incident de cette session, fix #11).

### 2. `backdrop-filter` crée un containing block CSS

Tout `position: fixed` enfant d'un ancêtre avec `backdrop-filter` (ou `transform`, `filter`, `perspective`, `will-change`, `contain: layout|paint|strict`) se positionne par rapport à cet ancêtre, pas au viewport.

`.topbar` (globals.css:12) a `backdrop-filter: saturate(150%)`. `DashboardTopbar` a `backdrop-filter: blur(8px)`. Les modals/drawers/popovers descendants doivent utiliser `createPortal` pour s'extraire.

### 3. `docker compose up -d` peut ne pas recréer le container

Si l'image hash semble identique au précédent build, le container reste tel quel. Toujours utiliser `--force-recreate --no-deps <service>` pour les redéploiements.

Aussi : le `--no-cache` pour le build seulement quand les couches sont vraiment piégées (genre l'image a été buildée mais le `git pull` n'avait pas été fait avant).

### 4. Dedup keys astro events — tronquer au jour

La date d'un sky_event est calculée par recherche binaire `(lo + hi) / 2` (sky-events.service.ts:167) — pas déterministe à la milliseconde près entre deux runs. Inclure l'ISO complet dans `dedup_key` produit des doublons en DB. **Toujours `event.date.slice(0, 10)`**.

### 5. Optimistic updates avec deep merge

Les `notify_events` est un objet imbriqué. Une mutation `{ notify_events: { eclipses: false } }` ne doit pas écraser `lunations: true`. Pattern dans `useUpdateNotificationPreferences` :

```ts
const next = {
  ...previous,
  ...patch,
  notify_events: { ...previous.notify_events, ...(patch.notify_events ?? {}) },
};
```

### 6. `kairosText` est généré dans **une seule langue** au dispatch

Pas de `kairosText.fr` + `kairosText.en` côté DB. La langue est figée au moment où le dispatcher tourne, basée sur `prefs.locale` du user à cet instant. Toggle FR/EN côté client → seul le titre switche, le body reste dans la langue d'origine. Si on veut bilingue : DB schema change requis.

### 7. Buildx installé en user-level sur le VPS

`~/.docker/cli-plugins/docker-buildx` (binaire v0.33+, pas le package apt qui n'existe pas pour `docker.io` package Ubuntu). Builder par défaut : `astro-builder` (BuildKit container).

---

## TODO / dette technique restante

- [ ] **Promotion des types notifications vers `@astro-platform/types`** (actuellement dupliqués entre `apps/api/src/types/notification-payload.ts` et `apps/web/src/lib/api/notifications.ts`). Risque : nouveau désalignement (déjà vécu 2 fois cette session : payload shape + UserPreferences).
- [ ] **Pagination cursor du drawer** : backend `?cursor=ISO` déjà OK, juste l'UI "Charger plus" à wirer (~1h).
- [ ] **Phase 1G mineure** : afficher la magnitude des éclipses dans le titre (besoin d'exposer ce champ depuis sky-events.service.ts).
- [ ] **Bilinguer `kairosText`** : trade-off coût LLM (×2 calls) vs UX. À valider produit avant.

---

## Prochaines phases candidates

### Phase 1G — Pagination + polish liste

- Bouton "Charger plus" dans le drawer (cursor pagination, déjà supporté backend)
- Filtre par type dans le drawer (toggle eclipses/lunations)
- Bouton "Effacer tout" (DELETE soft, à concevoir)
- Effort : ~1 session

### Phase 2 — Email digest

Gros chantier. Décisions infra à prendre :
- **Provider** : Postmark / Resend / SES / Mailgun ?
- **Queue** : utiliser Redis (déjà en place) avec BullMQ, ou un worker séparé ?
- **Templates** : MJML compilé côté API, ou éditeur visuel chez le provider ?
- **Cadence** : `notify_email_frequency: "weekly"` = lundi 9h locale user ? `"instant"` = à chaque dispatch si score ≥ threshold ?
- **Critique** : `notify_email_critical = true` overrides `frequency: never` pour les events à fort score uniquement ?

Effort : 1-2 sessions selon stack choisie.

### Phase 2 bis — Push web (PWA)

Très gros chantier.
- Manifest PWA + service worker
- VAPID keys + abonnement (`/notifications/push/subscribe` à créer)
- Stockage des subscriptions par user/device
- Worker push depuis le dispatcher quand nouvelle notif créée
- UI prompt permission + paramétrage

Effort : 2-3 sessions. Souvent plus tardif (après email qui couvre 80% du besoin reach).

---

## Commandes utiles

### Déploiement standard

```bash
cd /opt/astro-platform
tmux new -s deploy             # toujours utiliser tmux pour les builds longs
git pull origin main
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api web
# Détacher tmux : Ctrl+b puis d
# Réattacher : tmux attach -t deploy
```

Pour ne rebuild qu'un seul service : `build web` ou `build api`.

### Logs API filtrés

```bash
docker compose -f docker-compose.prod.yml logs --tail=80 api 2>&1 | \
  grep -iE "(notif|migration|🚀|error|FATAL|ready)"
```

### Inspecter la DB notifications

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT user_id, dedup_key, read_at, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;"

# Doublons éventuels (doit retourner 0 row)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT user_id, dedup_key, COUNT(*) FROM notifications GROUP BY 1, 2 HAVING COUNT(*) > 1;"

# Préférences d'un user
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT id, email, preferences FROM users LIMIT 5;"
```

### Forcer un dispatch manuel

Pas d'endpoint dédié. Le dispatcher tourne au boot + toutes les 6h. Pour forcer immédiatement : `restart api`.

### Linter / guardrails

```bash
pnpm lint:ci         # css-vars + forbidden-classes (CI-blocking)
pnpm test:fresh-db   # boot DB vide + migrations + smoke tests
```

---

## Config prod référence

- **VPS** : srv1565876, Ubuntu 24.04, user `astro`
- **Repo path** : `/opt/astro-platform`
- **Compose** : `docker-compose.prod.yml`
- **Reverse proxy** : Caddy 2 (auto Let's Encrypt) — `/api/*` → `api:4000`, reste → `web:3000`
- **DB** : Postgres 16, user `astro`, db `astro_platform`, password dans `.env.local`
- **Image registry** : GHCR (`ghcr.io/azdrian3/llmastro-{api,web}`) — push auto par CI sur `main`
- **Buildx** : binaire user-level dans `~/.docker/cli-plugins/`, builder par défaut `astro-builder`
- **6 users en prod** (au moment de cette session)

---

## Contacts / liens

- **Repo** : https://github.com/Azdrian3/llmastro
- **PRs notifs** : #1 → #17 (toutes mergées sur `main`)
- **Project guide** : `CLAUDE.md` à la racine du repo (working rules, stack, conventions)
