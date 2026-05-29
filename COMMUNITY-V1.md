# COMMUNITY-V1.md

Spec de référence de la première brique communautaire de llmastro :
**les statistiques sociales anonymes** (« tu fais partie des X % qui partagent ce placement »).

Ce document suit la convention de `GROWTH_PLAN.md` : les **Décisions actées** sont
figées, les **Décisions ouvertes** doivent être tranchées avant d'écrire le code du
chantier `COMMUNITY-V1`. À écrire **avant** la moindre ligne de code.

---

## TL;DR

- V1 = **agrégats anonymes uniquement**. Aucune exposition d'un utilisateur à un autre.
  « 23 % des membres partagent ta Lune en Scorpion », distribution des placements,
  positionnement de l'utilisateur dans la population. Dimensions V1 = **big three**
  (Soleil, Lune, Ascendant), feature **gratuite**.
- **k-anonymité stricte** : un bucket ne s'affiche que s'il regroupe ≥ `K_MIN` membres
  (**20**). En dessous, on remonte d'un cran de granularité ou on masque.
- **Opt-in d'inclusion** : un membre n'entre dans les agrégats que s'il a activé
  `community_stats_opt_in`. Par défaut **désactivé**. Pas de consentement → pas de
  comptage, dans aucun sens.
- **Stockage Postgres**, pas Neo4j (cf. § « Pourquoi pas Neo4j »). Une table de
  placements dénormalisée + des `GROUP BY` indexés suffisent à cette échelle.
- Surface : un encart « Ta place dans le ciel collectif » sur `/dashboard`, et une carte
  partageable (hook acquisition, cf. `GROWTH_PLAN.md`).
- Hors scope V1 : tout user-à-user (tribus nommées, matching, messagerie). Voir
  `ROADMAP` communautaire en fin de doc.

---

## Pourquoi pas Neo4j

Décision actée : **Neo4j est retiré du projet** (cf. commit de ce chantier).

- L'audit (2026-05) a montré que Neo4j était utilisé **en écriture seule** : le code y
  écrivait des thèmes (`storeNatalChart`) mais ne les relisait jamais. Les méthodes de
  lecture (`findSunSignCommunity`, `findChartsWithAspect`) n'étaient appelées nulle part.
- Les stats anonymes V1 sont des **agrégations** (`COUNT … GROUP BY`), pas du parcours de
  graphe multi-hop. Postgres les fait nativement et bien mieux à notre volume
  (quelques milliers de membres).
- Neo4j ne « gagnerait son loyer » (≈ 3 Go de RAM) que sur du **matching par similarité
  de graphe / détection de communautés (GDS)** — c'est-à-dire le chantier `COMMUNITY-V3`
  (Affinités), à très haut risque produit/privacy et non engagé. S'il est un jour lancé,
  la couche graphe sera réévaluée alors (Neo4j Aura, ou `pgvector` sur Postgres selon le
  besoin réel), sur la base de données d'usage. On ne paie pas l'infra d'une feature
  hypothétique.

---

## Décisions actées

### Périmètre & confidentialité

- [C-01] **V1 = agrégats anonymes only**. Aucune route ne renvoie l'identité, l'email,
  le pseudo ni le thème d'un autre membre. Aucune.
- [C-02] **Opt-in explicite** : colonne `users.community_stats_opt_in` (boolean, défaut
  `false`). Un membre n'est compté dans aucun agrégat tant qu'il ne l'a pas activé.
- [C-03] **k-anonymité** : un bucket (combinaison de placements) n'est rendu que si son
  `count >= K_MIN`. `K_MIN = 20` au MVP, configurable via env `COMMUNITY_K_MIN`.
- [C-04] Si le bucket demandé est sous le seuil, l'API **dégrade la granularité** dans cet
  ordre : (planète+signe+degré) → (planète+signe) → (planète+élément) → masqué. Elle ne
  renvoie jamais un `count` brut sous `K_MIN`.
- [C-05] **Désinscription = effacement immédiat** de la contribution : couper l'opt-in
  retire le membre des agrégats au prochain rafraîchissement (cf. C-12), et son thème
  n'est plus projeté dans la table de placements communautaire.
- [C-06] **Données projetées minimales** : seuls les placements astrologiques dérivés
  (planète → signe/degré/maison/élément/modalité) entrent dans la table communautaire.
  **Jamais** la date, l'heure, le lieu de naissance, ni quoi que ce soit de ré-identifiant.
- [C-07] La projection se fait à partir du **thème natal "principal"** du membre (le sien),
  pas des profils tiers qu'il a pu créer (amis, célébrités). `natal_data` n'ayant pas de
  notion de profil "moi", on ajoute un flag **`natal_data.is_self`** désigné par le membre
  (un seul `is_self = true` par user). L'opt-in communautaire exige qu'un profil principal
  soit désigné. (Tranché O-02.)
- [C-22] **Dimensions exposées en V1 = "big three"** : Soleil, Lune, Ascendant. Soleil et
  Lune sont toujours disponibles ; l'**Ascendant n'est projeté que si l'heure de naissance
  est connue** (`birth_time_unknown = false`), sinon la dimension est simplement absente
  pour ce membre. Les autres planètes / dominantes sont reportées à une itération
  ultérieure. (Tranché O-04.)
- [C-23] **Feature gratuite** : le cœur (placement du membre vs population + carte
  partageable) n'est pas gated derrière un plan payant — le volume d'opt-in est nécessaire
  à la k-anonymité et nourrit l'acquisition. Une couche premium (analytics avancées) reste
  possible plus tard. (Tranché O-03.)

### Modèle de données

- [C-08] Une table `community_placements` (Postgres) dénormalise, par membre opt-in et par
  planète, le placement nécessaire aux agrégats. Une ligne par (membre, planète).
- [C-09] La table ne contient **pas** de FK exposable hors backend : `user_id` reste interne
  et n'est jamais renvoyé par une route communautaire.
- [C-10] La table est **dérivée / reconstructible** à 100 % depuis `natal_data` +
  le moteur d'éphémérides. Elle peut être `TRUNCATE`/rebuild sans perte.

### Calcul & fraîcheur

- [C-11] La projection d'un membre est (re)calculée : à l'activation de l'opt-in, et au
  recalcul de son thème principal. Pas de calcul à la volée par requête de lecture.
- [C-12] Les **agrégats** servis aux lectures sont **mis en cache Redis** (TTL court, ex.
  15 min, clé versionnée `community:vN:…`), reconstruits par `GROUP BY` au cache-miss.
  Même pattern gracieux que le cache existant (`ai.ts`, `compat.ts`) : Redis down ⇒ on
  recalcule en direct, pas de crash.
- [C-13] Pas de job planifié au MVP : le cache + le recalcul à l'écriture suffisent.

### Anti-abus / robustesse

- [C-14] Le seuil `K_MIN` est la défense principale contre la ré-identification par
  recoupement. Aucune route ne permet de croiser deux dimensions au point de descendre
  sous `K_MIN` (la dégradation C-04 s'applique sur la combinaison demandée).
- [C-15] Les routes communautaires de lecture passent par `authMiddleware` (membres
  connectés uniquement au MVP) — pas d'endpoint public anonyme en V1.
- [C-16] L'opt-in et son retrait sont **journalisés** (timestamp `community_opt_in_at`),
  pour traçabilité du consentement (exigence RGPD).

### Surface

- [C-17] `GET /community/me/placement-stats` — pour chaque planète du thème principal du
  membre opt-in, renvoie `{ planet, sign, percentile/share, k_ok }`. Renvoie un état
  « active l'opt-in » si non inscrit.
- [C-18] `GET /community/distribution?dimension=sun_sign|moon_sign|…` — distribution
  agrégée d'une dimension (toujours soumise à k-anonymité C-03/C-04).
- [C-19] `POST /community/opt-in` / `DELETE /community/opt-in` — active/retire le
  consentement (déclenche projection / effacement, C-05/C-11).
- [C-20] UI : encart « Ta place dans le ciel collectif » sur `/dashboard` + une **carte
  partageable** (image générée) branchée sur la mécanique d'acquisition de `GROWTH_PLAN.md`.
- [C-21] Tarification : **gratuite** (C-23). Pas de gate `requireEntitlement` sur les
  routes de lecture ; `authMiddleware` seul (C-15). Une couche premium éventuelle viendra
  plus tard avec sa propre clé d'entitlement.

---

## Décisions ouvertes

Toutes les décisions bloquantes O-01..O-04 ont été tranchées (cf. Journal des décisions).

- [O-05] **Carte partageable** : périmètre exact (quelles stats affichées, branding,
  lien d'acquisition) — direction par défaut actée (carte big three + pourcentage phare,
  lien `?ref=` réutilisant le cookie de parrainage), **détail différé** au moment de coder
  la carte (en aval des routes de lecture).

---

## Schéma (acté O-01..O-04)

```sql
-- Migration COMMUNITY-V1 (Postgres).

ALTER TABLE users
  ADD COLUMN community_stats_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN community_opt_in_at    TIMESTAMPTZ;        -- C-16, traçabilité consentement

-- C-07 : désignation du thème "moi" (un seul is_self=true par user, garanti par index partiel).
ALTER TABLE natal_data
  ADD COLUMN is_self BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX natal_data_one_self_per_user
  ON natal_data (user_id) WHERE is_self;

CREATE TABLE community_placements (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet     VARCHAR(16) NOT NULL,
  sign       VARCHAR(16) NOT NULL,
  sign_degree SMALLINT,                                 -- nullable si heure inconnue
  house      SMALLINT,                                  -- nullable si heure inconnue
  element    VARCHAR(8)  NOT NULL,                       -- fire|earth|air|water
  modality   VARCHAR(8)  NOT NULL,                       -- cardinal|fixed|mutable
  PRIMARY KEY (user_id, planet)
);

-- Index pour les GROUP BY de distribution (C-18) et les agrégats k-anonymes.
CREATE INDEX community_placements_planet_sign ON community_placements (planet, sign);
CREATE INDEX community_placements_planet_elem ON community_placements (planet, element);
```

> Note : `community_placements` est **dérivée** (C-10). Elle ne contient aucune donnée de
> naissance ré-identifiante (C-06). Elle est peuplée par un service de projection appelé à
> l'opt-in et au recalcul du thème (C-11).
>
> En V1 (C-22), la projection n'écrit que **3 lignes par membre** : `planet = 'Sun'`,
> `'Moon'`, et `'Ascendant'` (cette dernière uniquement si l'heure est connue ; `house`
> reste `NULL` pour l'Ascendant, qui est un angle). `element`/`modality` proviennent du
> signe occupé.

---

## Hors scope V1 — ROADMAP communautaire

- **COMMUNITY-V2 — Tribus opt-in** : groupes d'appartenance nommés (« les Soleil-Lion »),
  exposition d'identité ⇒ opt-in `discoverable` distinct + planchers k-anonymité. Faisable
  sur Postgres. À lancer si V1 montre de l'appétit.
- **COMMUNITY-V3 — Affinités / matching** : recommandation user-à-user par similarité de
  thème (réutilise le moteur de synastrie `synastry.service.ts`). **Seul chantier qui
  justifierait une base graphe / similarité dédiée.** Chantier XL : modération, blocage,
  signalement, messagerie, liabilité réseau social. À n'engager que validé par V1/V2, avec
  une décision d'infra prise sur données d'usage réelles.

---

## Journal des décisions

- [O-01] **Tranché** : `K_MIN = 20` (configurable via `COMMUNITY_K_MIN`). Conservateur ;
  les stats mono-dimension restent affichées grâce à la dégradation C-04.
- [O-02] **Tranché** : projection du **thème "moi" seul**, désigné par un flag
  `natal_data.is_self` (un seul par user). Cf. C-07.
- [O-03] **Tranché** : feature **gratuite** (le volume d'opt-in est nécessaire à la
  k-anonymité et nourrit l'acquisition). Cf. C-23 / C-21.
- [O-04] **Tranché** : dimensions V1 = **big three** (Soleil, Lune, Ascendant si heure
  connue). Cf. C-22.
- [O-05] **Direction actée, détail différé** : carte big three + pourcentage phare, lien
  `?ref=` (cookie parrainage). Finalisée au moment de coder la carte.
