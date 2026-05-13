# Notifications System — Session Handoff

**Date** : 2026-05-12
**Phase 1 + 1G+ polish** : Complète et déployée en prod
**URL prod** : https://llmastro.com

---

## Ce qui est livré (32 PRs mergées)

### Foundation (Phase 1A → 1F)

| PR | Phase | Description |
|---|---|---|
| #1-3 | 1A | DB schema (`notifications`, `users.preferences`), types, routes squelettes |
| #4 | 1B | Sky events — détection lunations + éclipses sur fenêtre 7 jours |
| #6-9 | 1C | Personalization — `event-relevance.service` (scoring) + `Kairos` LLM (xAI) génère un texte perso par event×user |
| #10 | 1D | Dispatcher — boot task `startNotificationDispatcher`, run immédiat + scheduler 6h |
| #11 | fix | `ensureNotificationsSchema()` inline le SQL (fix incident `column "preferences" does not exist`) |
| #12 | 1E | UI bell + drawer (mobile-first, 380px slide depuis la droite) |
| #13 | fix | Drawer via `createPortal` (les ancêtres `backdrop-filter` clippaient le `position: fixed`) |
| #14 | fix | Types frontend alignés sur la vraie shape backend |
| #15 | fix | `dedup_key` tronqué à `YYYY-MM-DD` + migration data one-shot (`normalizeDedupKeysToDay`) |
| #16 | polish | Titre enrichi avec signe zodiacal + click notif = mark read + close + nav |
| #17 | 1F | Préférences UI + `PATCH /mark-all-read` + bouton "Tout marquer lu" |

### Cap & cleanup (Phase 1G)

| PR | Description |
|---|---|
| #19 | Cap dur à 10 notifs/user au dispatch (`insertIfNew` purge les anciennes) |
| #20 | Cleanup : pagination cursor retirée (dead code avec cap=10) |

### Polish & i18n (Phase 1G+ — session 2026-05-12)

| PR | Description |
|---|---|
| #21 | Promotion des types notifications vers `@astro-platform/types` (fin de la dette de duplication api/web) |
| #22 | Magnitude éclipses dans le titre (`total`/`partial`/`marginal` classifié sur distance Soleil↔nœud) |
| #23 | Signe zodiacal dans le titre éclipse (aligné avec lunations) |
| #24 | Filter pills dans le drawer (Toutes / Lunaisons / Éclipses / Système avec counts) |
| #25 | Bilinguer `kairosText` au format JSONB `{ fr, en }` — pipeline 2 calls Grok (génération canonique + traduction best-effort) |
| #26 | i18n cartouche `QuotaSummary` (subscription dashboard) |
| #27 | Backfill bilingual pour les rows legacy (boot task one-shot) |
| #28 | i18n transits horoscope + helper client-side moon phase via `key` |
| #29 | Speedup builds Docker : BuildKit cache mounts + `--frozen-lockfile` + retrait du `swisseph@latest` |
| #30 | Helper moon phase appliqué aux 4 surfaces restantes (NatalDatasheet, DailyEphemeris, KairosTrace, transits) |
| #31 | Bouton "Effacer tout" dans le drawer (hard delete, prompt natif) |
| #32 | Daily horoscope teaser à 8h locale user + `.dockerignore` propre (context 900MB → 2MB) |

---

## Architecture en bref

### Backend (`apps/api`)

**Boot order** (`src/index.ts:165-200`) :

```
runMigrations()                       → tables historiques
initSchemaCoherence()
initAdminFlag/StatsTables/...
ensureNotificationsSchema()           → CREATE TABLE notifications + ALTER users.preferences
normalizeDedupKeysToDay()             → migration dedup_key (idempotent)
backfillBilingualKairosText() (async) → migration rows kairosText: string → { fr, en }
startTokenCleanup()
startSkyPublication()
startNotificationDispatcher()         → run immédiat + setInterval 6h (sky events)
startDailyHoroscopeScheduler()        → run immédiat + setInterval 1h (horoscope quotidien 8h locale)
```

**Routes** (préfix `/notifications`, toutes auth) :

| Route | Description |
|---|---|
| `GET    /` | Liste (cap=10, pas de pagination). Returns `{ items, unreadCount }` |
| `PATCH  /:id/read` | Mark single |
| `PATCH  /mark-all-read` | Mark all unread |
| `DELETE /all` | Hard-delete toutes les notifs du user (PR #31) |
| `GET    /preferences` | `ResolvedUserPreferences` (defaults appliqués) |
| `PATCH  /preferences` | Patch partiel, deep merge serveur |

**Services clés** :
- `notification-dispatcher.service.ts` — pour chaque user × event sky-event, scoring + génération + traduction + INSERT IF NEW
- `daily-horoscope-dispatcher.service.ts` — scan horaire, dispatch les users qui sont à 8h locale `NOW`
- `event-narrative.service.ts` — génération Kairos (`generateEventNarrative`) + traduction (`translateEventNarrative`)
- `horoscope-teaser.service.ts` — teaser court 1-phrase pour la notif quotidienne
- `event-relevance.service.ts` — scoring + `buildSkyEventDedupKey`
- `sky-events.service.ts` — détection lunations/éclipses (avec magnitude qualitative + sign)
- `notifications.service.ts` — CRUD + `markAllAsRead` + `deleteAllForUser` + `insertIfNew` (avec purge cap=10)

**Notification kinds** (sur le wire `data.kind`) :
- `"sky_event"` — éclipses, lunations
- `"system"` — messages plateforme (placeholder, non utilisé pour l'instant)
- `"horoscope_daily"` — notif quotidienne 8h locale

### Frontend (`apps/web`)

**Composants** :
- `NotificationBell.tsx` — bouton + badge unread
- `NotificationsPanel.tsx` — drawer via `createPortal`, filter pills, mark-all-read, clear-all
- `NotificationItem.tsx` — item liste, derive titre+body+emoji par kind
- `app/dashboard/notifications/preferences/page.tsx` — page settings (4 sections + toggle daily horoscope)

**Hooks** (`hooks/useNotifications.ts`) :
- `useNotificationsList()` — query, poll 60s, key `["notifications"]`
- `useMarkNotificationRead()` — mutation optimistic
- `useMarkAllNotificationsRead()` — mutation optimistic
- `useClearAllNotifications()` — mutation optimistic (hard delete)
- `useNotificationPreferences()` — query, staleTime 5min
- `useUpdateNotificationPreferences()` — mutation optimistic avec deep merge

**API helpers** (`lib/api/notifications.ts`) :
- `notificationsApi.{ list, markRead, markAllRead, clearAll, getPrefs, updatePrefs }`
- Re-exports des types depuis `@astro-platform/types` (PR #21)

**Helpers i18n** :
- `lib/i18n/moon-phase.ts` (PR #28) — `getLocalizedMoonPhase(key, lang)` → `{ phase, description }`. Utilise `moonPhase.key` (locale-agnostic) plutôt que les strings FR du payload engine

---

## Gotchas appris (lis avant de toucher au code)

### 1. Pas de `runMigrations` qui lit les `.sql` — pattern projet inline

`runMigrations` dans `db/index.ts` n'est PAS un loader de fichiers. C'est une fonction qui inline le SQL des tables historiques. Les `.sql` dans `apps/api/src/db/migrations/*` ne sont que traces, jamais lus à l'exécution.

**Convention** : chaque migration = un boot task `init-X.ts` qui inline le SQL en `IF NOT EXISTS`. Cf. `init-readings.ts`, `init-schema-coherence.ts`, `ensureNotificationsSchema`.

Ne jamais committer un `.sql` sans son boot task miroir.

### 2. `backdrop-filter` crée un containing block CSS

Tout `position: fixed` enfant d'un ancêtre avec `backdrop-filter` (ou `transform`, `filter`, `perspective`, `will-change`, `contain: layout|paint|strict`) se positionne par rapport à cet ancêtre, pas au viewport.

`.topbar` (globals.css) a `backdrop-filter: saturate(150%)`. `DashboardTopbar` a `backdrop-filter: blur(8px)`. Les modals/drawers/popovers descendants doivent utiliser `createPortal` pour s'extraire.

### 3. `docker compose up -d` peut ne pas recréer le container

Si l'image hash semble identique au précédent build, le container reste tel quel. Utiliser `--force-recreate --no-deps <service>` si besoin de forcer.

### 4. Dedup keys astro events — tronquer au jour

La date d'un sky_event est calculée par recherche binaire `(lo + hi) / 2` (sky-events.service.ts:167) — pas déterministe ms-précis entre runs. Inclure l'ISO complet dans `dedup_key` produit des doublons. **Toujours `event.date.slice(0, 10)`**.

Pour les daily horoscope notifs, le dedup_key est `horoscope_daily:<userId>:<YYYY-MM-DD>` où la date est dans la **tz user** (pas UTC) pour bien séparer les jours locaux.

### 5. Optimistic updates avec deep merge

`notify_events` est un objet imbriqué. Une mutation `{ notify_events: { eclipses: false } }` ne doit pas écraser `lunations: true`. Pattern dans `useUpdateNotificationPreferences` :

```ts
const next = {
  ...previous,
  ...patch,
  notify_events: { ...previous.notify_events, ...(patch.notify_events ?? {}) },
};
```

### 6. `kairosText` est **bilingue** depuis PR #25

Stocké au format `{ fr, en }` en DB. La canonique est dans la lang user au dispatch, l'autre est une traduction LLM best-effort (peut être absente si la traduction a fail). Type union `KairosText = string | { fr?, en? }` pour rester compat avec les rows legacy (le reader narrow sur `typeof === "string"`).

Reader frontend, ordre de fallback :
1. Lang demandée si présente
2. Lang opposée si présente (traduction → canonique, ou vice-versa)
3. `FALLBACK_BODY[lang]` déterministe

### 7. Buildx installé en user-level sur le VPS

`~/.docker/cli-plugins/docker-buildx` (binaire v0.33+, pas le package apt). Builder par défaut : `astro-builder` (BuildKit container).

### 8. Daily horoscope — timezone via `Intl.DateTimeFormat`

Pas de lib externe pour la conversion tz. `Intl.DateTimeFormat('en-CA', { timeZone, hour, year, month, day, hour12: false }).formatToParts(now)` retourne les parts en local user. Implémentation dans `daily-horoscope-dispatcher.service.ts:getLocalHourAndDate`.

Scheduler scan toutes les heures (24x/jour). À chaque scan, pour chaque user : skip si `localHour !== 8`. Dedup_key journalier empêche les doublons si plusieurs scans dans la fenêtre 8h-9h.

À 6 users en prod, scale ~144 user-checks/jour. Optimisable plus tard via batch par offset UTC si on passe 1000+.

### 9. Build context size (`.dockerignore` indispensable)

Sans `.dockerignore`, `COPY . .` envoie ~900 MB de contexte au daemon (node_modules + .git + .next + ...). Observé 11 min de transfer time sur le web build prod.

Le `.dockerignore` à la racine exclut node_modules, .git, .next, .turbo, dist, .env*, etc. Mesuré : context post-ignore ~2 MB.

Pour activer les `RUN --mount=type=cache,...` dans les Dockerfiles : directive `# syntax=docker/dockerfile:1.5` en tête. Sans BuildKit (DOCKER_BUILDKIT=1 ou compose v2 par défaut), les cache mounts sont silencieusement ignorés.

### 10. Hooks React Query order vs early return

Dans `NotificationsPanel`, les `useMemo` pour `counts` et `filteredItems` (PR #24) doivent être déclarés **AVANT** le `if (!open || !mounted) return null` — sinon Rules of Hooks violées (nombre de hooks varie selon le retour). Les variables non-hooks (`lang`, `t`, `isEmpty`) peuvent rester après l'early return.

---

## TODO / dette technique restante

- [ ] **i18n complet `/ciel`** (page publique). Server component FR-pinned par design (titres, "Lune :", metadata SEO). Demande probablement routing per-lang `/en/ciel/...`. Hors scope quick-fix.
- [ ] **i18n NatalDatasheet** : la fiche PDF imprimable reste majoritairement FR (titres section, "illuminée", etc.) sauf la moon phase. Audit complet à faire.
- [x] **Magnitude éclipse précise** (ECLIPSE-MAGNITUDE-V1) : actuellement classification qualitative (`total`/`partial`/`marginal`) basée sur la distance Soleil-nœud. ~~Pour avoir un vrai chiffre, exposer `swe_sol_eclipse_when_glob` depuis `@astro-platform/ephemeris`.~~ → Implémenté via `swe_sol_eclipse_where` + `swe_lun_eclipse_how`, `EclipseEvent` enrichi avec `magnitudePrecise` + `kindPrecise`, affiché sur `/ciel`.
- [x] **Détection auto-locale au signup** (AUTO-LOCALE-V1) : ~~actuellement default à FR, on pourrait lire `Accept-Language` header au register.~~ → Lu et appliqué à `preferences.locale` au signup ; default FR si tag non-EN.
- [ ] **Lune noire (Lilith)** dans le thème natal : ajouter le calcul du Mean Apogee (SE_MEAN_APOG, ipl 12) et/ou Osculating Apogee (SE_OSCU_APOG, ipl 13) dans `@astro-platform/ephemeris`. Point géométrique (apogée de l'orbite lunaire), pas un astre physique. Choix mean vs osculating à arbitrer (mean = lisse, osculating = instantané — préférer mean pour la stabilité du thème natal). Surface UI à définir : ajout dans la liste des positions du natal-wheel + interprétation Kairos.
- [ ] **Routing Haiku pour la traduction kairos** : optimisation si la facture xAI > $50/mois. Économie attendue ~30-50% sur les traductions (vs Grok pour les deux calls).
- [ ] **Mesure runtime** : valider le speedup `.dockerignore` au prochain rebuild VPS (context attendu ~2-10 MB au lieu de 913 MB).

---

## Prochaines phases candidates

### Phase 1G — Polish liste ✅ complète (PRs #19-#32)

Choix retenu : cap dur à 10 notifs/user au dispatch (purge dans `insertIfNew`). Constante `NOTIFICATIONS_CAP_PER_USER = 10` dans `notifications.service.ts`. Point d'entrée unique si on relève le cap (Phase 2 emails/push pourrait justifier 20-50).

Polish ajouté : filter pills, magnitude/sign éclipse, clear-all, daily horoscope, i18n, build perf.

### Phase 2 — Email digest

Gros chantier. Schema bilingue déjà prêt (PR #25 — `data.kairosText.fr/en` suffit pour adresser un destinataire EN ou FR sans regénérer).

Décisions infra à prendre :
- **Provider** : Postmark / Resend / SES / Mailgun ?
- **Queue** : utiliser Redis (déjà en place) avec BullMQ, ou worker séparé ?
- **Templates** : MJML compilé côté API, ou éditeur visuel chez le provider ?
- **Cadence** : `notify_email_frequency: "weekly"` = lundi 9h locale user ? `"instant"` = à chaque dispatch si score ≥ threshold ?
- **Critique** : `notify_email_critical = true` overrides `frequency: never` pour les events à fort score uniquement ?

Effort : 1-2 sessions selon stack choisie.

### Phase 2 bis — Push web (PWA)

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
ssh astro@72.62.58.240
cd /opt/astro-platform
tmux new -s deploy             # ALWAYS use tmux pour les builds longs (cf. incident SSH disco)
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build api web
# Détacher tmux : Ctrl+b puis d
# Réattacher  : tmux attach -t deploy
```

Pour ne rebuild qu'un seul service : ajouter `api` ou `web` à la commande.

Si BuildKit ne semble pas actif (pas de `RUN --mount=type=cache,...` dans les logs), forcer :
```bash
DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml up -d --build api web
```

### Logs API filtrés

```bash
docker compose -f docker-compose.prod.yml logs --tail=80 api 2>&1 | \
  grep -iE "(notif|migration|🚀|error|FATAL|ready|daily-horoscope|backfill)"
```

### Inspecter la DB notifications

```bash
# Liste des notifs récentes (toutes catégories)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT user_id, kind, dedup_key, read_at, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;"

# Détail du payload bilingue (kairosText pour sky_event, body pour horoscope_daily)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT id, kind, jsonb_typeof(data->'kairosText') AS kairos_shape, data->'kairosText' AS kairos, data->'body' AS body, created_at
   FROM notifications ORDER BY created_at DESC LIMIT 5;"

# Doublons éventuels (doit retourner 0 row)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT user_id, dedup_key, COUNT(*) FROM notifications GROUP BY 1, 2 HAVING COUNT(*) > 1;"

# Préférences d'un user (incluant notify_daily_horoscope)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astro -d astro_platform -c \
  "SELECT id, email, timezone, preferences FROM users LIMIT 5;"
```

### Forcer un dispatch manuel

Pas d'endpoint dédié. Les dispatchers tournent au boot + sur leur intervalle (6h pour sky-events, 1h pour daily horoscope). Pour forcer immédiatement : `docker compose restart api`.

Pour tester le daily horoscope hors-fenêtre 8h locale : changer temporairement `users.timezone` en DB pour tomber pile sur 8h `now`, puis restart api.

### Linter / guardrails

```bash
pnpm lint:ci         # css-vars + forbidden-classes (CI-blocking)
pnpm test:fresh-db   # boot DB vide + migrations + smoke tests
pnpm type-check      # tsc --noEmit per package
```

---

## Config prod référence

- **VPS** : srv1565876 (`72.62.58.240`), Ubuntu 24.04, user `astro`
- **Repo path** : `/opt/astro-platform`
- **Compose** : `docker-compose.prod.yml`
- **Reverse proxy** : Caddy 2 (auto Let's Encrypt) — `/api/*` → `api:4000`, reste → `web:3000`
- **DB** : Postgres 16, user `astro`, db `astro_platform`, password dans `.env.local`
- **Image registry** : GHCR (`ghcr.io/azdrian3/llmastro-{api,web}`) — push CI sur `main`, mais le prod compose **build local** (pas de pull GHCR)
- **Buildx** : binaire user-level `~/.docker/cli-plugins/`, builder `astro-builder` (BuildKit). Cache mounts confirmés actifs PR #29.
- **`.dockerignore`** : à la racine depuis PR #32, exclut node_modules/.git/.next/dist etc. (context 900MB → 2MB).
- **6 users en prod** (mai 2026).

---

## Contacts / liens

- **Repo** : https://github.com/Azdrian3/llmastro
- **PRs notifs** : #1 → #32 (toutes mergées sur `main`)
- **Project guide** : `CLAUDE.md` à la racine du repo (working rules, stack, conventions)
- **Branche feature standard** : `claude/read-github-markdown-acA2G`
