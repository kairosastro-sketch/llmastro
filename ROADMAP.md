# ROADMAP — Llmastro

> Chantiers issus de l'audit de la page `/methode` (2026-05-21).
> Chaque item a été vérifié contre le code (`packages/ephemeris`, `apps/api`, `apps/web`).

---

## 🟡 Chantier 0 — Corriger la page `/methode` (texte périmé)

La page `/methode` annonce comme « à venir » plusieurs choses **déjà livrées**.
4 affirmations fausses à rectifier dans `apps/web/src/components/landing/MethodDetails.tsx` :

| Section | Affirmation actuelle (fausse) | Réalité vérifiée |
|---|---|---|
| IV — Points sensibles | Phases lunaires + rétrogradations « non exposées », « datasheet à venir (chantier 6) » | **Fait** — `NatalDatasheet.tsx` + route `/dashboard/natal/[id]/sheet` ; affiche rétrogrades (`datasheet_retrograde/direct`) et phase lunaire (`getLocalizedMoonPhase`) |
| IV — Points sensibles | « Part de Fortune » listée dans les *non-implémentés* | **Fait** — `partOfFortune()` dans `swiss-engine.ts` / `astro-engine.ts`, affichée dans le datasheet (`⊕ Part de Fortune`) |
| IV — Points sensibles | Contradiction interne : PdF listée non-faite *puis* « points arabes au-delà de la Part de Fortune » | À nettoyer |
| VII — Pour aller plus loin | « bibliographie… sera ajoutée prochainement (chantier dédié) » | **Fait** — page `/bibliographie` live (liée dans le footer), composant `SourceAttribution.tsx` existe |

**Effort :** S (texte uniquement, 1 fichier). Aucun risque.
**Statut :** différé (décision utilisateur 2026-05-21).

---

## 🔵 Chantier 1 — Fonctionnalités astrologiques réellement absentes

Vérifié absent de `packages/ephemeris/src` et `apps/api/src`.
La page `/methode` (section IV) les marque « parqués dans la feuille de route, sans engagement de date ».

| Feature | Nature du travail | Taille | Statut |
|---|---|---|---|
| **Vertex** | Swiss Ephemeris `swe_houses().vertex` → `EnrichedChart` → section « Angles » du datasheet natal | S | ✅ **Fait** (VERTEX-V1) |
| **Antiscia / contre-antiscia** | Dérivation pure (antiscion = 180−λ, contre-antiscion = 360−λ) → section « Antiscia » du datasheet natal | S | ✅ **Fait** (ANTISCIA-V1) |
| **Aspects mineurs** (semi-sextile, semi-carré, sesquicarré, quintile) | Ajout d'entrées au moteur d'aspects (natal + transits/synastrie) + légendes UI + table des orbes de `/methode`. NB : le quinconce est déjà implémenté | M | À faire |
| **Dignités planétaires** (domicile, exaltation, exil, chute) | Table de correspondances + logique de scoring + UI | M | À faire |
| **Points arabes** (autres que la Part de Fortune) | Jeu de formules (ex. PdF = ASC + Lune − Soleil) + exposition | M | À faire |
| **Harmoniques** au-delà du 8ᵉ | Variante de thème (longitudes × N mod 360) + UI dédiée | L | À faire |

**Statut :** Vertex + Antiscia livrés (VERTEX-V1, ANTISCIA-V1 — 2026-05-21) — reste 4 items.
Pas d'engagement de date — priorité produit à arbitrer.
Séquencement suggéré : du plus petit (aspects mineurs) au plus gros (harmoniques).

**Note Vertex** : extrait de Swiss Ephemeris uniquement. En mode moteur de
secours `astracore` (rare), le Vertex est `null` — pas de formule devinée.

---

## 🟢 Chantier 2 — i18n EN de `/methode`

`MethodDetails.tsx` — les 7 sections détaillées (Calculs, Conventions, Orbes, Points
sensibles, Kairos, Versions, Lectures) sont **FR hardcodé** (confirmé par le commentaire
`// Texte hardcodé en FR (sweep i18n EN dans le backlog)` et l'absence de `t()`).
Le hero + les 3 piliers + la section transparence de `MethodPage.tsx` sont, eux, déjà i18n.

**Travail :** extraire ~7 sections de texte vers `apps/web/src/lib/i18n/translations.ts`
(FR + EN), brancher `t()` dans `MethodDetails.tsx`.
**Effort :** M (volume de texte). Sans risque.
**Statut :** non démarré.

---

## Priorisation suggérée

1. **Chantier 0** — la page `/methode` induit les visiteurs en erreur (annonce comme futur ce qui est en ligne). Petit effort, fort impact crédibilité. *(différé)*
2. **Chantier 2** — bien borné, sans risque, utile SEO / anglophones.
3. **Chantier 1** — vrais développements, à séquencer par taille croissante.
