# CALCULS — Documentation & audit du moteur astrologique de Llmastro

> Audit du code réalisé le **2026-05-21** contre `packages/ephemeris/src`,
> `apps/api/src/services` et `apps/api/src/routes`.
> Document de référence : décrit **ce que le code calcule réellement**, les
> **options de calcul** et la raison des choix, puis liste les **manques** et
> les **incohérences** détectés.
>
> Convention de lecture :
> - 🟢 conforme / bien fait — 🟡 manque ou imprécision — 🔴 incohérence ou bug probable.
> - Les références entre `code` pointent vers `fichier::fonction`.

---

## 0. Statut des corrections — 2026-05-21

Les corrections décidées avec le mainteneur (périmètre « Bugs + page + cohérence »)
ont été appliquées le 2026-05-21, **après** l'audit initial documenté ci-dessous.

| ID | Sujet | État |
|---|---|---|
| **B1** | Part de Fortune — sect jour/nuit inversée | ✅ Corrigé (`astro-engine` + `swiss-engine`) + test de non-régression dans `chart.test.ts` |
| **B2** | Stations détectées ~12 h trop tôt | ✅ Corrigé — `isRetrograde` passé en différence finie **centrée** |
| **C1** | Trois tables d'orbes divergentes | ✅ Corrigé — table canonique unique (`ASPECT_TYPES`, package ephemeris) ; transits volontairement plus serrés (documenté), synastrie réalignée sur le natal + quinconce ajouté |
| **C2** | `source` toujours `"meeus"` | ✅ Corrigé — type élargi `"meeus" \| "swiss"` ; `swiss-engine` rapporte `"swiss"` |
| **C3** | Événements du ciel hors routeur | ✅ Corrigé — `allPositions` / `isRetrograde` / `moonPhase` désormais routés |
| **C4** | Magnitude d'éclipse en `SEFLG_SWIEPH` | ✅ Corrigé — passé en `SEFLG_MOSEPH` (cohérent, sans fichiers `.se1`) |
| **C5** | Ayanamsa Lahiri maison en mode swiss | ⏸️ **Laissé en l'état** — l'API du binding natif `swisseph` ne peut être vérifiée hors ligne (règle « ne jamais inventer d'API ») ; le sidéral n'est pas exposé en UI → priorité basse. Voir §11. |
| **C6** | Moteur absent de la clé de cache | ✅ Corrigé — `getActiveEngine()` intégré à la clé, version `chart:v4`→`v5` |
| **C7** | Tonalité du quinconce incohérente | ✅ Corrigé — `tendu` partout, page `/methode` incluse |
| **I1–I10** | Affirmations fausses de `/methode` | ✅ Corrigé — `MethodDetails.tsx` réécrit (sections I à IV + VII) |

**Hors périmètre de cette passe** : les manques G1–G12 (§13), dont le chantier 1
de la `ROADMAP` (aspects mineurs, dignités, points arabes, harmoniques).
Note : **l'antiscia (initialement dans G6) a été livré séparément** le 2026-05-21
(commit `feat(web): expose les antiscia`, calculé dans `NatalDatasheet.tsx`).
**C5** reste le seul item du périmètre non corrigé (raison ci-dessus).

---

## 1. Vue d'ensemble de l'architecture

Tous les calculs astronomiques vivent dans le package `@astro-platform/ephemeris`
(`packages/ephemeris/src`). Le reste (transits, synastrie, événements, scoring)
est dans `apps/api/src/services`.

### 1.1 Deux moteurs, un routeur

| Moteur | Fichier | Méthode | Rôle |
|---|---|---|---|
| **Swiss Ephemeris** (mode Moshier) | `swiss-engine.ts` | Théorie semi-analytique de Steve Moshier, binaire natif `swisseph` | Moteur **principal** |
| **AstraCore** | `astro-engine.ts` | Séries de Meeus (Soleil/Lune) + éléments orbitaux képlériens simplifiés (planètes) | Moteur **de secours** |

Le choix se fait au runtime dans `engine-router.ts::resolveEngine()` :

1. `ASTRO_ENGINE=astracore` → AstraCore explicite.
2. `ASTRO_ENGINE=swisseph` ou non défini → tentative de chargement du binaire
   natif `swisseph` ; **s'il échoue** (build sans `node-gyp`, ESM strict sans
   `require`…), repli **gracieux** sur AstraCore avec un `console.warn`.
3. Le moteur résolu est mis en cache (résolution unique, aucun coût par requête).

**Pourquoi ce choix ?** Swiss Ephemeris est la référence du milieu, mais c'est
un binaire natif dont le build peut échouer en CI/conteneur contraint. Le repli
maison évite un crash en cascade. Diagnostic via `getEngineDiagnostic()` (route
`/admin/ephemeris/health`).

🟢 Le pattern routeur + repli est sain.
🔴 **Voir §11 (incohérences C3)** : seules `computeChartFromJD` / `computeCurrentSky`
passent par le routeur. Les helpers bruts (`allPositions`, `isRetrograde`,
`moonPhase`, `jd`) sont exportés **directement depuis AstraCore** — le service
d'événements du ciel les utilise et tourne donc **toujours en mode Meeus**,
même quand `ASTRO_ENGINE=swisseph`.

### 1.2 Mode Moshier — pourquoi pas le mode complet ?

`swiss-engine.ts` utilise le flag `SEFLG_MOSEPH` :

- **Avantage** : aucun fichier d'éphémérides `.se1` requis sur disque.
- **Précision** : ~1 arcseconde, plage −3000 à +3000 (couvre tous les cas natals).
- **Limite** : Chiron et les astéroïdes **ne sont pas disponibles** en Moshier —
  ils exigeraient les fichiers d'éphémérides. C'est pour cela que le mode swisseph
  expose la **Lilith moyenne** mais **pas Chiron**, et inversement pour AstraCore
  (voir §6.4).

> Source : documentation Swiss Ephemeris, *swephprg.htm* §2.1 et *swisseph.htm*
> (modes `SEFLG_SWIEPH` / `SEFLG_JPLEPH` / `SEFLG_MOSEPH`).
> https://www.astro.com/swisseph/swephprg.htm

---

## 2. Pipeline d'un thème natal

Point d'entrée applicatif : `service.ts::EphemerisService.calculateNatalChart()`.

```
saisie locale {date, heure, IANA tz, lat, lng}
   │
   ├─ 1. localToUTC()           → instant UTC absolu + JD UT          (§3)
   ├─ 2. clé de cache Redis     → hash des entrées influentes          (§2.1)
   ├─ 3. computeChartFromJD()   → routé vers swiss ou astracore        (§4–§6)
   │       ├─ positions planétaires
   │       ├─ ajustement sidéral éventuel
   │       ├─ maisons + angles (ASC/MC/Vertex)
   │       ├─ maison de chaque planète
   │       ├─ rétrogrades
   │       ├─ aspects
   │       ├─ Part de Fortune
   │       └─ phase lunaire
   ├─ 4. métadonnées (offset, résolution tz, birthTimeKnown)
   └─ 5. enrich() → numérologie (chemin de vie) + DTO EnrichedChart
```

### 2.1 Cache Redis

`service.ts::chartCacheKey()` — la clé est `chart:v4:{natalId}:{sha1[:16]}` où le
hash porte **uniquement les champs qui changent le résultat** : date, heure,
IANA tz, lat/lng (quantifiés à 4 décimales ≈ 10 m), zodiaque, système de maisons,
`birthTimeKnown`.

**Pourquoi** : keyer sur `natalId` seul servirait un thème périmé après édition
du profil. La quantification lat/lng absorbe les micro-variations de saisie.

🔴 **Le nom du moteur (`ASTRO_ENGINE`) n'entre pas dans la clé.** Si un repli
swisseph→astracore survient entre deux requêtes, un thème calculé par l'autre
moteur peut être resservi (incohérence C6, §11).

---

## 3. Conversion heure locale → UTC

Fichier : `time-utc.service.ts::localToUTC()`. **Source unique de vérité.**

- S'appuie sur **Luxon** + la base **IANA tzdata**.
- Gère correctement : heure d'été/hiver, **règles DST historiques** (ex. France
  1940-45, changements de fuseaux), heures **ambiguës** (recul automnal — 02:30
  se produit 2×) et **inexistantes** (avance printanière — 02:30 n'existe pas).
- Politiques configurables : `onAmbiguous` (`earliest` par défaut / `latest` /
  `throw`), `onNonExistent` (`shiftLater` par défaut / `throw`).
- **Rejette explicitement les offsets fixes** (`+01:00`, `UTC+1`…) :
  `time-utc.service.ts::NUMERIC_OFFSET_RE`. Raison : un offset fixe ne porte pas
  les règles DST historiques → perte de précision silencieuse.

JD UT calculé en `buildResult()` : `jdUT = utcMs / 86400000 + 2440587.5`
(2440587.5 = JD de l'époque Unix, 1970-01-01 00:00 UTC).

🟢 **Point fort du projet.** L'ancienne logique « dernier dimanche de mars/octobre »
maison (`astro-engine.ts::isDST`, désormais `@deprecated`) était fausse hors
Europe occidentale et avant 1996. La version actuelle est robuste et bien testée
(`tests/time-utc.test.ts`).

> Sources : IANA Time Zone Database — https://www.iana.org/time-zones ·
> Luxon — https://moment.github.io/luxon/

---

## 4. Positions planétaires

### 4.1 Moteur Swiss Ephemeris — `swiss-engine.ts::allPositionsSwiss()`

`swe_calc_ut(JD, ipl, SEFLG_MOSEPH | SEFLG_SPEED)` pour chaque corps. Le flag
`_ut` signifie que l'entrée est en **Temps Universel** : Swiss Ephemeris applique
**lui-même** le ΔT (différence TT − UT) pour obtenir les positions. `SEFLG_SPEED`
fournit la vitesse en longitude → utilisée directement pour le statut rétrograde.

Positions **apparentes** (correction de temps-lumière, aberration et nutation
incluses par défaut).

Corps couverts (`getPlanetIpl()`) : Soleil, Lune, Mercure→Pluton, **Nœud moyen**
(`SE_MEAN_NODE`), **Lilith moyenne** (`SE_MEAN_APOG`). **Pas de Chiron** en mode
Moshier.

### 4.2 Moteur AstraCore — `astro-engine.ts::allPositions()`

- **Soleil** : série de Meeus, *Astronomical Algorithms* ch. 25 (longitude moyenne
  `L0`, anomalie moyenne `M`, équation du centre `C`, nutation, aberration
  −0,005694°). Précision ~1′.
- **Lune** : série principale de Brown tronquée à ~14 termes (`moonGeo()`).
  **Précision ~0,3°** — le commentaire du code l'indique explicitement.
- **Planètes** (`helioPos3D()` + `helioToGeoLon()`) : **éléments orbitaux
  képlériens moyens** (table `PE`) — longitude moyenne, périhélie, excentricité
  avec termes linéaires en temps ; résolution de l'équation de Kepler par
  Newton ; transformation plan orbital → écliptique → géocentrique géométrique.
- **Nœud lunaire** : `lunarNode()` = nœud **moyen** (`125,0446 − 1934,1363·T + …`).

Positions **géométriques** : pas de correction de temps-lumière ni d'aberration
pour les planètes (voir §10, manque G2).

**Précision réelle d'AstraCore** : les tests de non-régression
(`tests/swiss-engine.test.ts`) tolèrent **2° à 3°** sur les planètes et **5°** en
contrôle croisé. Pluton et Chiron, orbites fortement perturbées, sont les moins
fiables.

> Sources : Meeus, J. *Astronomical Algorithms*, 2ᵉ éd., Willmann-Bell, 1998
> (ch. 25 Soleil, ch. 47 Lune). · Moshier ephemeris : théorie semi-analytique
> ajustée sur l'éphéméride JPL DE404.

### 4.3 Choix : pourquoi deux niveaux de précision ?

AstraCore n'est **pas** censé égaler Swiss Ephemeris : son rôle est d'éviter un
crash et de rester « dans le bon signe » pour la grande majorité des cas. C'est
un choix raisonnable **à condition que la communication produit le dise** — ce
qui n'est pas le cas aujourd'hui (incohérence I4, §11).

---

## 5. Maisons et angles (ASC / MC / Vertex)

### 5.1 Temps sidéral et angles

AstraCore — `astro-engine.ts` :

- `gmst(JD)` : temps sidéral de Greenwich, formule IAU 1982 (Meeus ch. 12).
- `lst = gmst + longitude` → RAMC (ascension droite du Milieu du Ciel).
- `calcASC()` / `calcMC()` : formules standard de l'ascendant et du MC
  (Meeus ch. 24), à partir du RAMC, de la latitude et de l'obliquité moyenne
  `obl(T)` (Meeus ch. 22).

### 5.2 Systèmes de maisons

| Système | Clé | AstraCore | Swiss Ephemeris |
|---|---|---|---|
| **Placidus** (défaut) | `placidus` | Itératif Newton (`placidusHouses`) | `swe_houses(…, 'P')` |
| **Koch** | `koch` | 🔴 **repli silencieux sur Placidus** (`kochHouses`) | `swe_houses(…, 'K')` |
| **Égales** | `equal` | `equalHouses` (ASC + i·30°) | `swe_houses(…, 'E')` |
| **Signe entier** | `whole_sign` | `wholeSignHouses` | `swe_houses(…, 'W')` |

**Pourquoi Placidus par défaut ?** C'est le système dominant de l'astrologie
occidentale moderne. **Whole Sign** est proposé car plus stable aux hautes
latitudes (Placidus est mathématiquement indéfini au-delà du cercle polaire ;
`placidusHouses` y bascule sur une trisection ad-hoc — voir manque G8).

🔴 **`kochHouses()` d'AstraCore renvoie purement et simplement le résultat
Placidus** (commentaire : « le template n'implémente pas explicitement Koch »).
Donc en mode de secours, choisir « Koch » donne du Placidus sans avertissement.
Koch n'est *vrai* que lorsque swisseph est actif.

> **HOUSES-DOMIFICATION-FIX-V1 (2026-06-11)** — la domification AstraCore
> était cassée avant ce correctif : double correction de quadrant dans
> `calcMC` (MC/IC inversés pour tout RAMC ∈ (90°, 270°), soit la moitié des
> heures de naissance) et dans la conversion AR→longitude de `pCusp`
> (cuspides intermédiaires flippées de 180°), plus une différence
> ascensionnelle fausse (`atan(sin φ·tan δ)` au lieu de `asin(tan φ·tan δ)`,
> δ depuis l'AR au lieu de la longitude écliptique, coefficients 4/3 et 5/3
> au lieu de 2/3 et 1/3 pour les maisons 2 et 3 — jusqu'à ~17° d'écart).
> La prod (swisseph) n'était pas affectée. Corrigé et verrouillé par
> `tests/houses.test.ts` (ancres exactes + référence Swiss Ephemeris à
> ±0,1°, sans dépendance au binaire swisseph).

### 5.3 Vertex (`VERTEX-V1`)

Exposé uniquement par Swiss Ephemeris (`swe_houses().vertex`, soit `ascmc[3]`).
En mode AstraCore, `vertex = null` — **aucune formule devinée**, choix
explicitement assumé (`ROADMAP.md`, note Vertex). 🟢 Bonne hygiène.

### 5.4 Maison d'une planète

`houseOfLongitude(lon, cusps)` : recherche linéaire de la cuspide encadrante,
avec gestion du passage 360°→0°. Convention : maisons 1-6 sous l'horizon,
7-12 au-dessus (cuspide 1 = ASC, cuspide 10 = MC, cuspide 7 = ASC+180°).

---

## 6. Aspects

### 6.1 Aspects natals — `astro-engine.ts::calculateAspects()`

Table `ASPECT_TYPES` (partagée par les deux moteurs) :

| Aspect | Angle | Orbe de base | Tonalité |
|---|---|---|---|
| Conjonction | 0° | 8° | neutre |
| Sextile | 60° | **6°** | harmonique |
| Carré | 90° | 7° | tendu |
| Trigone | 120° | **8°** | harmonique |
| Opposition | 180° | 8° | tendu |
| Quinconce | 150° | 3° | tendu |

**Bonus luminaires** : `calculateAspects()` ajoute **+2°** à l'orbe dès qu'un
aspect implique le Soleil ou la Lune — pour **tous** les types d'aspect.

`exact` est marqué si l'écart à l'angle exact est < 1°. Les nœuds et la Part de
Fortune sont **exclus** du calcul d'aspects (`skip = {northNode, southNode,
fortune}`).

### 6.2 Aspects de transit — `transits.service.ts::ASPECT_TYPES`

| Aspect | Orbe | | Aspect | Orbe |
|---|---|---|---|---|
| Conjonction | 8° | | Carré | 7° |
| Opposition | 8° | | Sextile | **5°** |
| Trigone | **7°** | | *(pas de quinconce)* | |

Pas de bonus luminaire. Priorité = `poids(planète transit) + poids(planète natale)
− orbe·1,5` ; les planètes lentes pèsent le plus (`PLANET_WEIGHT` : Saturne/Pluton
10, Soleil/Jupiter 8…).

### 6.3 Aspects de synastrie — `synastry.service.ts::ASPECT_DEFS`

| Aspect | Orbe | | Aspect | Orbe |
|---|---|---|---|---|
| Conjonction | 8° | | Carré | **8°** |
| Sextile | **6°** | | Trigone | 8° |
| Opposition | 8° | | *(pas de quinconce)* | |

🔴 **Trois tables d'orbes divergentes** (natal / transits / synastrie) coexistent
sans source commune — voir incohérence C1 (§11). L'orbe d'un trigone vaut 8°
en natal, 7° en transit, 8° en synastrie ; un sextile : 6 / 5 / 6.

**Sur le choix des orbes** : il n'existe **aucune norme universelle**. Les valeurs
8/8/7/7/5 sont une convention répandue ; Hand et Greene en utilisent d'autres,
souvent avec orbes plus larges pour les luminaires. La table publiée sur la page
`/methode` correspond aux orbes **de transit**, pas à ceux du **thème natal**
(incohérence I7).

> Référence : aucune source ne fait autorité — voir Hand, R. *Horoscope Symbols*
> (1981) et la pratique courante. C'est un **choix produit** à assumer.

### 6.4 Scoring (transits & synastrie)

`synastry.service.ts::scoreSynastry()` et `horoscope.ts::computeThemeScores()`
produisent des scores 0-100 par dimension. **Ce sont des heuristiques
propriétaires** (pondérations `PLANET_WEIGHTS`, bases +10/−6, multiplicateur
d'orbe, clamp 5-95) — utiles produit, mais **sans canon astrologique de
référence**. À documenter comme tel côté UI : ce ne sont pas des « calculs »
mais une grille de lecture maison.

---

## 7. Éléments dérivés

### 7.1 Rétrogrades

- **Swiss** : signe de `longitudeSpeed` (`SEFLG_SPEED`) — vitesse instantanée. 🟢
- **AstraCore** : `isRetrograde(key, JD)` compare la longitude géocentrique à
  `JD` et `JD+1` — **différence finie avant sur 24 h**.

🔴 Cette différence **avant** (et non centrée) introduit un **biais systématique
d'environ 12 h** dans la détection des **stations** (`sky-events.service.ts`) :
voir bug B2 (§11). Pour un thème natal isolé, l'impact est négligeable (erreur
seulement dans les 12 h autour d'une station).

### 7.2 Phase lunaire — `moonPhase()` / `moonPhaseFromLongitudes()`

Élongation `el = (longitude Lune − longitude Soleil) mod 360`, découpée en
**8 phases** : les 4 phases « pivot » (nouvelle, premiers/derniers quartiers,
pleine) occupent une fenêtre étroite de 22,5° (±11,25°), les 4 phases croissantes/
décroissantes une fenêtre large de 67,5°.

Illumination ≈ `(1 − cos(el)) / 2` — approximation de la fraction éclairée
(exacte à la place de l'angle de phase Soleil-Terre-Lune ; écart négligeable, le
Soleil est lointain). Source : Meeus ch. 48.

🟡 En mode swisseph, `moonPhaseFromLongitudes()` repart des longitudes Swiss
(précises) ; mais la table de descriptions FR (`MOON_PHASES_FR`) est **dupliquée**
entre `astro-engine.ts` et `swiss-engine.ts` (dette mineure).

### 7.3 Part de Fortune — `partOfFortune()`

Formules **correctes** et conformes à la tradition (sect-sensible) :

- Thème **de jour** (Soleil au-dessus de l'horizon) : `ASC + Lune − Soleil`
- Thème **de nuit** : `ASC + Soleil − Lune`

🔴 **BUG PROBABLE — détermination jour/nuit inversée.** Dans
`computeChartFromJD` (les **deux** moteurs, même code copié) :

```js
const sunAbove = ((sunLon - houses.asc + 360) % 360) < 180;
const pofLon = partOfFortune(sunLon, moonLon, houses.asc, !sunAbove);
```

`(sunLon − ASC) mod 360 < 180` est vrai quand le Soleil est dans les **maisons
1 à 6**, c'est-à-dire **sous** l'horizon. La variable `sunAbove` vaut donc `true`
pour une naissance **de nuit** et `false` pour une naissance **de jour** — elle
est inversée. Conséquence : `isNight = !sunAbove` est lui aussi inversé, et un
thème de jour reçoit la formule de nuit (et inversement).

Vérification rapide : à midi, le Soleil est près du MC, donc `(sunLon−ASC) mod
360 ≈ 270 ≥ 180` → `sunAbove = false` → `isNight = true` → formule de nuit
appliquée à une naissance de jour. ❌

**Impact** : la Part de Fortune affichée (`⊕ Part de Fortune` du datasheet natal)
est calculée avec la mauvaise formule pour environ **la moitié des thèmes**.
**Correctif** : la condition doit être `>= 180` (ou renommer `sunAbove` en
`sunBelow` et utiliser `partOfFortune(…, sunBelow)`).
**À valider** contre astro.com (Astrodienst calcule la Part de Fortune
sect-sensible par défaut) avant de patcher.

> Sources : Ptolémée, *Tetrabiblos* III.10 ; convention moderne sect-sensible :
> Hand, R. ; Astrodienst (option « day/night » de la Part of Fortune).

### 7.4 Nœuds lunaires

Les **deux moteurs utilisent le nœud MOYEN** :
- Swiss : `SE_MEAN_NODE` (commentaire explicite : « Pour passer en nœud vrai :
  `SE_TRUE_NODE` »).
- AstraCore : `lunarNode()` = formule du nœud moyen.

Le **nœud Sud** est dérivé : `Sud = Nord + 180°`.

**Pourquoi le nœud moyen ?** Il est lisse et stable (le nœud vrai oscille de
~±1,5° à cause des perturbations à courte période). C'est un choix défendable —
mais voir incohérence I1 : la page `/methode` annonce le nœud **vrai**.

### 7.5 Lilith / Chiron — corps dépendants du moteur

| Corps | Swiss (Moshier) | AstraCore |
|---|---|---|
| **Chiron** | ❌ absent (exige les fichiers `.se1`) | ✅ éléments orbitaux (précision médiocre) |
| **Lilith moyenne** | ✅ `SE_MEAN_APOG` | ❌ non calculée (`LILITH-V1`) |

🔴 **Aucun moteur ne fournit Chiron ET Lilith simultanément.** Le jeu de corps
d'un thème **dépend du moteur actif**. La page `/methode` annonce « treize
points… Chiron et Lilith moyenne » — jamais vrai pour un même thème
(incohérence I3).

### 7.6 Numérologie — chemin de vie

`numerology.ts::computeLifePath()` (NUMEROLOGY-MODULE-V1 — extraite de
`service.ts`) : réduit **séparément** jour, mois et année à un chiffre, puis
somme, puis réduction finale **en préservant les nombres maîtres 11/22/33**
(résultat final uniquement). Testée dans `tests/numerology.test.ts`.

✅ L'ancienne **seconde** implémentation de `astro-engine.ts::computeChart()`
(déprécié), qui sommait **tous les chiffres de la date d'un coup** et divergeait
pour certaines dates (ex. 1879-03-14 : 33 au lieu de 6), a été **supprimée** —
`computeChart` délègue désormais au module unique.

**Pourquoi réduire jour/mois/année séparément ?** C'est la méthode pythagoricienne
la plus courante. Variante non retenue : préserver 11/22 aussi dans les composantes
intermédiaires — choix légitime mais non implémenté ici.

---

## 8. Transits — `transits.service.ts`

- `computeTransitAspects()` : aspects ciel-du-moment → thème natal (table d'orbes
  §6.2, tri par priorité).
- `computeHouseActivations()` : maison natale traversée par chaque planète en
  transit.
- `generateAlerts()` : top-3 aspects exacts + rétrogrades marquants.

Le ciel du moment est calculé via `ephemerisService.calculateNatalChart()` avec
`ianaTz: "UTC"` et l'instant courant (routes `transits.ts`, `horoscope.ts`) →
**passe bien par le routeur de moteur**. 🟢 Cache horaire (`hourBucket`) pour
limiter les recalculs.

---

## 9. Synastrie — `synastry.service.ts`

`computeSynastryAspects()` : aspects inter-planétaires A↔B (table §6.3), pondérés
par `PLANET_WEIGHTS`. `scoreSynastry()` : 6 dimensions (`love`, `communication`,
`intimacy`, `stability`, `growth`, `challenges`) + score global.

Option `excludeMoon` : ignore la Lune quand l'heure de naissance est inconnue
(la Lune bouge ~13°/jour → sa position est trop incertaine sans heure fiable).
🟢 Bon réflexe.

⚠️ `challenges` : **haut = plus de friction = moins bon** ; le global utilise
`100 − challenges`. Sémantique inversée à garder en tête côté UI.

---

## 10. Événements du ciel — `sky-events.service.ts`

Détecte sur une fenêtre `[start, end)` : **ingrès** (changements de signe),
**stations** R/D, **lunaisons** (4 phases majeures), **éclipses**.

Méthode : échantillonnage à pas adaptatif par corps (Lune 6 h, Soleil/planètes
internes 24 h, planètes lentes 30 j…) puis **bissection** (8 itérations) pour
affiner.

### 10.1 Éclipses

Détection dérivée des lunaisons : une nouvelle/pleine Lune est une éclipse si le
Soleil est proche d'un nœud lunaire. Seuils (`sky-events.service.ts`) :

| | Total | Partielle | Marginale | Orbe de déclenchement |
|---|---|---|---|---|
| Solaire | ≤ 10° | ≤ 16° | au-delà | 18° |
| Lunaire | ≤ 5° | ≤ 10° | au-delà | 12° |

Enrichissement `ECLIPSE-MAGNITUDE-V1` : `computeSolarEclipseDetailsSwiss()` /
`computeLunarEclipseDetailsSwiss()` appellent `swe_sol_eclipse_where` /
`swe_lun_eclipse_how` pour obtenir magnitude précise, type et série de Saros.

> Sources : NASA/GSFC Eclipse — https://eclipse.gsfc.nasa.gov ·
> Espenak & Meeus, *Five Millennium Canon of Solar Eclipses*.

🔴 Plusieurs problèmes — voir incohérences C3, C4 et manque G12 (§11) :
- toute la détection (ingrès, stations, lunaisons, distance-nœud) tourne sur
  **AstraCore (Meeus)**, jamais sur Swiss, même quand `ASTRO_ENGINE=swisseph` ;
- l'enrichissement magnitude demande le flag `SEFLG_SWIEPH` (fichiers `.se1`)
  alors que le moteur est conçu sans fichiers → `magnitudePrecise` peut être
  silencieusement `null` en production.

---

## 11. Sidéral & ayanamsa

`computeChartFromJD` accepte `zodiac: "tropical" | "sidereal"`. En sidéral, on
soustrait l'ayanamsa à toutes les longitudes (planètes + cuspides + ASC/MC/Vertex).

`astro-engine.ts::ayanamsa(JD)` : polynôme du 2ᵉ degré approchant l'**ayanamsa
Lahiri** (`22,460 + 1,3748·(y−1900)/100 − 0,000572·(y−1900)²/10⁶`).

🟡 Approximation : donne ~23,83° en 2000 contre ~23,85° officiel (écart ~1,4′) ;
~24,18° en 2026. La précession annuelle codée (1,3748°/siècle) est ~1,5 % sous la
valeur réelle (~1,396°/siècle). Surtout : **même en mode swisseph**, c'est ce
polynôme maison qui est utilisé — `swe_get_ayanamsa_ut()` (Lahiri exact) n'est
**pas** appelé (incohérence C5).

**Pourquoi tropical par défaut ?** Convention occidentale dominante. Le sidéral
est calculable par l'API mais **non exposé dans l'UI** (cohérent avec `/methode`).

> Source : *Indian Astronomical Ephemeris* ; ayanamsa Chitrapaksha (Lahiri).

---

## 12. Sources vérifiables

| Domaine | Source |
|---|---|
| Moteur principal | Swiss Ephemeris — https://www.astro.com/swisseph/ (doc `swephprg.htm`, `swisseph.htm`) |
| Soleil, Lune, sidéral, maisons, JD, obliquité, nutation | Meeus, J. *Astronomical Algorithms*, 2ᵉ éd., Willmann-Bell, 1998 — ch. 7, 12, 22, 24, 25, 47, 48 |
| Mode Moshier | Steve Moshier, théorie semi-analytique ajustée sur JPL DE404 |
| Éphémérides JPL | DE431/DE441, Jet Propulsion Laboratory (utilisées par Swiss Eph. en mode `SWIEPH`/`JPLEPH` — **pas** en Moshier) |
| Fuseaux horaires | IANA Time Zone Database — https://www.iana.org/time-zones ; Luxon — https://moment.github.io/luxon/ |
| Éclipses | NASA/GSFC — https://eclipse.gsfc.nasa.gov ; Espenak & Meeus, *Five Millennium Canon* |
| Ayanamsa Lahiri | *Indian Astronomical Ephemeris* |
| Part de Fortune (sect) | Ptolémée, *Tetrabiblos* III.10 ; convention moderne : R. Hand |
| Théorie planétaire de référence | VSOP87 — Bretagnon & Francou, *Astron. Astrophys.* 202 (1988) 309 — **non implémentée** ici (voir I5) |

---

## 13. Manques (🟡)

| # | Manque | Détail |
|---|---|---|
| **G1** | **ΔT non appliqué en mode AstraCore** | `allPositions()` passe le JD **UT** directement dans des polynômes de Meeus qui attendent du **Temps Terrestre (TT)**. Swiss Ephemeris, lui, applique ΔT. Écart ~70 s en 2026 (négligeable sur le signe), bien plus grand pour les dates anciennes. Les *maisons* AstraCore sont correctes (le temps sidéral dépend bien de l'UT). |
| **G2** | Positions AstraCore géométriques | Pas de correction de temps-lumière ni d'aberration pour les planètes. La nutation est appliquée au Soleil/Lune mais pas aux planètes → incohérence de référentiel ~17″ entre luminaires et planètes (négligeable pour signes/aspects). |
| **G3** | Pas d'aspects aux nœuds / à la Part de Fortune | `calculateAspects()` exclut `northNode`, `southNode`, `fortune`. Certains praticiens veulent les aspects aux nœuds. |
| **G4** | Maisons égales inaccessibles | Le moteur gère `equal`, mais la route `POST /ephemeris/calculate` ne mappe que `P`/`K`/`W`. |
| **G5** | Koch absent du moteur de secours | `kochHouses()` AstraCore renvoie Placidus (voir §5.2). |
| **G6** | Fonctionnalités astrologiques absentes | Aspects mineurs (semi-carré, semi-sextile, sesquicarré, quintile), dignités (domicile/exaltation/exil/chute), points arabes au-delà de la Part de Fortune, harmoniques > 8. Suivi dans `ROADMAP.md` chantier 1. *(Vertex et antiscia, initialement listés ici, ont depuis été livrés.)* |
| **G7** | `jd()` toujours en calendrier grégorien proleptique | Pas de bascule calendrier julien/grégorien (1582). Pour des dates très anciennes, écart de ~10-13 jours avec le comportement par défaut de swisseph. Sans impact sur les usages natals/actuels. |
| **G8** | Placidus aux latitudes polaires | `placidusHouses()` bascule sur une trisection ad-hoc si Newton diverge (au-delà du cercle polaire) — résultat non-Placidus, sans avertissement. |
| **G9** | Précision Chiron / Pluton en AstraCore | Orbites fortement perturbées + éléments képlériens simplifiés → erreurs de plusieurs degrés (tests à 3° de tolérance). |
| **G10** | Tarot — signe solaire approximatif | `horoscope.ts::sunSignFromBirthDate()` utilise des dates de cuspide fixes → faux sur les jours de cuspide (±1 jour). Choix assumé dans le code, mais à connaître. |
| **G11** | Éclipses échantillonnées hors maximum | `computeSolar/LunarEclipseDetailsSwiss` sont appelées au JD de la lunaison, pas au JD du **maximum d'éclipse** (qu'on obtiendrait via `swe_sol_eclipse_when_glob`). Magnitude/type légèrement décalés. |
| **G12** | Fonctions héritées encore exportées | `isDST`, `jdFromLocal`, `computeChart`, `calculateHouses` sont `@deprecated` (certaines *throw*) mais toujours dans l'API publique du package. |

---

## 14. Incohérences (🔴)

> **Mise à jour 2026-05-21 :** la quasi-totalité de ces incohérences a été
> corrigée — voir le **§0**. Les tableaux ci-dessous conservent le constat
> d'audit initial, à valeur d'historique.

### 14.1 Bugs probables dans le code

| # | Sévérité | Bug |
|---|---|---|
| **B1** | **Haute** | **Part de Fortune — sect jour/nuit inversée.** `sunAbove` est vrai quand le Soleil est sous l'horizon → formule jour/nuit échangée pour ~la moitié des thèmes. Détail et correctif en §7.3. Valeur affichée à l'utilisateur. |
| **B2** | Moyenne | **Stations détectées ~12 h trop tôt.** `isRetrograde()` (AstraCore) utilise une différence finie **avant** sur 24 h ; le passage par zéro de la vitesse moyenne se produit ~0,5 jour avant la station réelle. Corriger avec une différence **centrée** (`JD−0,5` / `JD+0,5`). La précision « ~30 min » annoncée en commentaire de `sky-events.service.ts` n'est pas atteinte. |

### 14.2 Incohérences code ↔ page `/methode` (texte public faux)

> La page `/methode` (`apps/web/src/components/landing/MethodDetails.tsx`) est en
> partie périmée. `ROADMAP.md` chantier 0 en signale déjà une partie (I2, I10) ;
> les autres sont nouvelles.

| # | Sévérité | Incohérence |
|---|---|---|
| **I1** | Haute | `/methode` (§II et §IV) annonce le **« Nœud Nord lunaire (vrai) »**. Le code utilise le nœud **moyen** dans les deux moteurs (§7.4). |
| **I2** | Haute | `/methode` (§IV) liste **Part de Fortune et Vertex parmi les « non implémentés »** — les deux sont implémentés (`partOfFortune()`, `VERTEX-V1`). *(déjà ROADMAP chantier 0)* |
| **I3** | Haute | `/methode` (§II/IV) annonce **« treize points… Chiron et Lilith moyenne »**. Aucun moteur ne fournit les deux : swisseph → pas de Chiron, AstraCore → pas de Lilith (§7.5). |
| **I4** | Haute | `/methode` (§I) affirme que le moteur de secours garde une précision **« sub-seconde d'arc »**. Faux : la Lune AstraCore est à ~0,3°, les planètes à 2-3° (tests). Erreur d'un facteur ~1000-10000. |
| **I5** | Moyenne | `/methode` (§I) dit que le moteur de secours implémente **« VSOP87 »**. Faux : VSOP87 est une théorie en séries trigonométriques (~1″). Le code utilise des **éléments orbitaux képlériens simplifiés**. Seuls le Soleil et la Lune utilisent des séries de Meeus. |
| **I6** | Moyenne | `/methode` (§I) dit que Swiss Ephemeris **« en mode Moshier dérive ses positions des tables JPL DE431 »**. Le mode Moshier est une **théorie semi-analytique** (ajustée sur DE404), pas une lecture des tables DE431. DE431 ne concerne que les modes `SWIEPH`/`JPLEPH`, non utilisés ici. |
| **I7** | Moyenne | La **table d'orbes** de `/methode` (§III : trigone 7°, sextile 5°) correspond aux orbes de **transit**, pas à ceux du **thème natal** (`calculateAspects` : trigone 8°, sextile 6°). |
| **I8** | Moyenne | `/methode` (§III) affirme que des orbes plus larges pour les luminaires sont **« non implémentés ici »**. Faux : `calculateAspects()` ajoute **+2°** dès qu'un luminaire est impliqué, sur **tous** les aspects. |
| **I9** | Basse | `/methode` (§II) décrit **Koch comme « variante de Placidus »** — astrologiquement inexact (Koch est un système distinct). De plus, en mode de secours, Koch *est* littéralement Placidus (§5.2). |
| **I10** | Basse | `/methode` (§IV) dit les phases lunaires/rétrogradations **« non encore exposées… datasheet à venir »** — le datasheet est livré. *(déjà ROADMAP chantier 0)* |

### 14.3 Incohérences internes au code

| # | Sévérité | Incohérence |
|---|---|---|
| **C1** | Moyenne | **Trois tables d'orbes** divergentes : `astro-engine.ts` (natal), `transits.service.ts`, `synastry.service.ts`. Ex. carré = 7°/7°/8° ; trigone = 8°/7°/8° ; sextile = 6°/5°/6°. Aucune source unique. |
| **C2** | Basse | `ChartResult.source` vaut **toujours `"meeus"`**, y compris quand Swiss Ephemeris produit le thème (`swiss-engine.ts` met `source: "meeus"` pour respecter le type littéral). Le champ ne permet pas d'identifier le moteur réel — seul `getEngineDiagnostic()` le fait. |
| **C3** | Moyenne | **`sky-events.service.ts` ignore le routeur de moteur.** Il importe `allPositions`, `isRetrograde`, `moonPhase`, `jd` directement depuis AstraCore. Ingrès, stations, lunaisons et déclenchement d'éclipses tournent **toujours en Meeus**, même avec `ASTRO_ENGINE=swisseph`. Précision dégradée du flux « Ciel public » (ingrès, lunaisons à ~0,3° de Lune ≈ ~35 min d'erreur de timing). |
| **C4** | Moyenne | `computeSolarEclipseDetailsSwiss` utilise `SEFLG_SWIEPH` (exige les fichiers `.se1`) alors que le reste du moteur est volontairement en `SEFLG_MOSEPH` (« aucun fichier requis »). Si le volume `swisseph_data` n'est pas peuplé, `magnitudePrecise` retombe silencieusement sur `null` (le `try/catch` masque l'échec). `ECLIPSE-MAGNITUDE-V1` peut être inopérant en prod. |
| **C5** | Basse | Le sidéral utilise le **polynôme Lahiri maison** même en mode swisseph ; `swe_get_ayanamsa_ut()` (Lahiri exact) n'est jamais appelé (§11). |
| **C6** | Basse | La **clé de cache** d'un thème n'inclut pas le moteur. Un repli swisseph↔astracore peut resservir un thème calculé par l'autre moteur (§2.1). |
| **C7** | Basse | Tonalité du quinconce : `ASPECT_TYPES` le déclare `"t"` (tendu) ; la table de `/methode` l'affiche `"n"` (neutre). |

---

## 15. Recommandations (par priorité)

1. **Corriger B1 (Part de Fortune)** — bug à impact utilisateur direct.
   Inverser la condition `sunAbove` (ou la renommer `sunBelow`). Ajouter un test
   de non-régression jour vs nuit comparé à astro.com.
2. **Réécrire la page `/methode`** pour lever I1–I10. C'est un enjeu de
   **crédibilité** : la page « transparence » contient des affirmations fausses.
   Points les plus graves : I4 (précision « sub-seconde » du fallback), I1 (nœud
   « vrai »), I3 (treize corps).
3. **Unifier les orbes (C1)** — extraire **une** table partagée
   `packages/ephemeris` consommée par natal, transits et synastrie ; aligner la
   table de `/methode` dessus (I7).
4. **Corriger B2** — différence finie centrée dans `isRetrograde` (ou step plus
   court) pour les stations.
5. **Router les événements du ciel (C3)** — exposer des variantes routées de
   `allPositions`/`isRetrograde`/`moonPhase`, ou faire passer `sky-events` par
   `computeChartFromJD`.
6. **Trancher C4** — soit déployer les fichiers `.se1` dans le volume
   `swisseph_data` et le documenter, soit passer les fonctions d'éclipse en
   `SEFLG_MOSEPH`, soit logguer explicitement quand `magnitudePrecise` est `null`.
7. **Mineur** : exposer le moteur réel dans `ChartResult.source` (C2) ; ajouter
   `ASTRO_ENGINE` à la clé de cache (C6) ; appliquer ΔT en mode AstraCore (G1).

> **Ce qui est bien fait** 🟢 — la conversion temps locale→UTC (IANA tzdata +
> Luxon, heures ambiguës/inexistantes, rejet des offsets fixes) ; le pattern
> routeur + repli gracieux ; la clé de cache fondée sur les entrées influentes ;
> le refus explicite de « deviner » le Vertex en mode AstraCore ; la couverture
> de tests (référence Einstein, cas DST). Le socle est solide ; les corrections
> ci-dessus concernent surtout la **cohérence** et la **communication**.

---

*Document généré lors de l'audit du 2026-05-21. À mettre à jour à chaque
changement touchant `packages/ephemeris` ou les services de calcul.*
