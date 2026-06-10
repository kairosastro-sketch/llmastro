# @astro-platform/ephemeris

Calculs astronomiques et astrologiques de la plateforme : thèmes nataux, ciel du
moment, transits, maisons, aspects, astrocartographie, éclipses. Consommé
directement **depuis les sources** (`main: ./src/index.ts`) par `apps/api` et
`apps/web` — pas d'étape de build du package en dev.

> Le détail des formules et des conventions astrologiques (points arabes,
> vertex, phases lunaires, numérologie…) est documenté dans
> [`CALCULS.md`](../../CALCULS.md) à la racine du repo. Ce README couvre
> l'architecture, les moteurs, la précision et l'exploitation.

## Architecture

```
index.ts                API publique (seul point d'entrée supporté)
├── engine-router.ts    Sélection runtime du moteur (ASTRO_ENGINE)
│   ├── swiss-engine.ts   Moteur principal : Swiss Ephemeris (mode Moshier)
│   └── astro-engine.ts   Moteur fallback : AstraCore (port maison Meeus/VSOP)
│                         + helpers calcul-pur partagés (aspects, maisons,
│                         Part de Fortune, jd, gmstDeg, n360…)
├── astrocartography.ts  Lignes AC/MC/DC/IC + parans (module pur)
├── time-utc.service.ts  Heure locale → UTC/JD (Luxon + IANA tzdata, LMT)
├── service.ts           Service haut niveau (cache Redis, enrichissement)
└── types.ts             CityResolver / CityCoords (injection au boot)
```

## Les deux moteurs

| | **swisseph** (défaut) | **astracore** |
|---|---|---|
| Implémentation | [Swiss Ephemeris](https://www.astro.com/swisseph/) via le module natif `swisseph` (optionalDependency, build node-gyp) | Port maison TypeScript pur (Meeus ch. 25, série de Brown, éléments orbitaux) |
| Précision longitude | **< 0.5″** (mesurée vs JPL Horizons, voir plus bas) | ~0.1–0.5° selon le corps |
| Usage | Prod, CI | Fallback si le binaire natif n'est pas chargeable (ex. dev Windows) |

Sélection par la variable d'env `ASTRO_ENGINE` (`swisseph` | `astracore`,
défaut `swisseph`). Si swisseph est demandé mais indisponible :

- **hors prod** : warning console + fallback gracieux vers AstraCore ;
- **`NODE_ENV=production`** : **crash volontaire au boot** — on refuse de
  servir silencieusement des positions dégradées. Échappatoire explicite :
  `ASTRO_ALLOW_FALLBACK=true`.

`getActiveEngine()` / `getEngineDiagnostic()` exposent le moteur effectif et le
log de résolution (utilisé par le health-check admin).

## Mode Moshier vs fichiers d'éphémérides `.se1`

Le moteur Swiss tourne en **mode Moshier** (`SEFLG_MOSEPH`) :

- aucun fichier d'éphémérides sur disque — l'analytique Moshier est un fit de
  l'intégration numérique DE du JPL ;
- plage de validité **-3000 → +3000** ;
- couvre Soleil, Lune, Mercure→Pluton, nœuds, Lilith moyenne.

Ce que le mode Moshier ne couvre **pas** : Chiron et les astéroïdes exigent les
fichiers `.se1` (mode `SEFLG_SWIEPH`). Le chemin des fichiers est configurable
via `SWISSEPH_PATH` (défaut `/usr/local/share/swisseph`, volume Docker
`swisseph_data` en prod) — il est posé au chargement mais n'est **lu** qu'en
mode fichiers. Bascule possible plus tard sans changer l'API du package.

⚠️ Piège connu (`ASTROCARTOGRAPHY-V1`) : avec `SEFLG_EQUATORIAL`, le wrapper
node renvoie l'ascension droite/déclinaison dans les champs
`rectAscension`/`declination` — **pas** `longitude`/`latitude`. Lire les
mauvais champs a déjà bloqué la prod (hang).

## Précision mesurée (HORIZONS-BENCHMARK-V1)

`tests/horizons-benchmark.test.ts` verrouille en CI un **écart < 1″** entre le
chemin de prod (`allPositionsSwiss`) et JPL Horizons (longitudes géocentriques
apparentes, écliptique vraie de la date) sur 10 corps × 4 dates (1900, 1970,
J2000, 2025). Écarts max mesurés à la création :

| Corps | Δ max | Corps | Δ max |
|---|---|---|---|
| sun | 0.24″ | jupiter | 0.38″ |
| moon | 0.42″ | saturn | 0.25″ |
| mercury | 0.26″ | uranus | 0.18″ |
| venus | 0.28″ | neptune | 0.38″ |
| mars | 0.24″ | pluto | 0.40″ |

Fixtures figées dans le test (aucun appel réseau) ; régénération :
`node scripts/fetch-horizons-fixtures.mjs`.

## Conversion temporelle (`localToUTC`)

`time-utc.service.ts` convertit une naissance (date, heure, tz IANA) en UTC +
JD UT via Luxon/tzdata :

- **règles historiques** (DST allemande 1940, règles France pré-1996…) ;
- **heures inexistantes** (bascule printemps) et **ambiguës** (automne) :
  comportement configurable (`shiftLater`/`earliest`/`throw` →
  `TimezoneError`) ;
- **LMT pré-heure-standard** (`TIME-UTC-LMT-V1`) : pour les naissances avant
  l'adoption de l'heure de zone, l'offset est dérivé de la **longitude du lieu**
  (heure solaire locale moyenne) et non du méridien de la zone tzdata —
  cf. le cas Einstein (Ulm, 1879) dans les tests.

Les longitudes numériques (`+02:00`) sont rejetées : tz IANA obligatoire.

## Zodiaque sidéral

En mode Swiss, l'ayanamsa Lahiri est le **natif** `swe_get_ayanamsa_ut`
(`AYANAMSA-SWISS-NATIVE-V1`) — exact, là où l'ancien polynôme maison dérivait
de ~80″ à J2000. AstraCore garde le polynôme (fallback, sans lib native).

## Service haut niveau (`ephemerisService`)

- cache Redis transparent (un miss recalcule — désactivable via
  `EPHEMERIS_DISABLE_REDIS=1`, ce que font les tests) ;
- résolution des villes par **resolver injecté au boot**
  (`ephemerisService.setCityResolver()`, branché sur la table Postgres
  `cities` côté API) — le package n'embarque aucune liste de villes ;
- enrichissement du thème (signes, maisons, numérologie `computeLifePath`).

## Tests

```bash
pnpm --filter @astro-platform/ephemeris test          # toute la suite
pnpm --filter @astro-platform/ephemeris exec vitest run tests/swiss-engine.test.ts
```

Suites : `chart` (assemblage), `swiss-engine` (précision Einstein, éclipses,
ayanamsa, cohérence cross-moteur), `time-utc` (DST/LMT), `astrocartography`,
`horizons-benchmark`.

**Garde-fou `EXPECT-SWISSEPH-V1`** : les tests Swisseph skippent proprement là
où le binaire natif n'est pas chargeable (ex. Windows), mais la CI pose
`EXPECT_SWISSEPH=1` (+ build natif explicite + preuve de chargement) — tout
skip silencieux du moteur principal y devient un **échec**. Ne pas retirer
cette variable de `ci.yml`/`turbo.json`.

À savoir côté tests : `test.runIf(...)` est évalué à la **collecte** — toute
condition de skip doit être calculée au niveau module, jamais dans un
`beforeAll`.

## Variables d'environnement

| Variable | Effet | Défaut |
|---|---|---|
| `ASTRO_ENGINE` | `swisseph` \| `astracore` | `swisseph` |
| `ASTRO_ALLOW_FALLBACK` | `true` = tolère le fallback AstraCore en prod | crash en prod |
| `SWISSEPH_PATH` | chemin des fichiers `.se1` (mode fichiers uniquement) | `/usr/local/share/swisseph` |
| `EPHEMERIS_DISABLE_REDIS` | `1` = aucun client Redis créé (tests) | cache actif |
| `EXPECT_SWISSEPH` | `1` = l'indisponibilité de swisseph fait échouer les tests | skip toléré |
| `VITEST_HARD_TIMEOUT_MS` | timeout mur du wrapper `scripts/ci/vitest-run.mjs` | `90000` |
