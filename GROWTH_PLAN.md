# GROWTH_PLAN.md

Plan consolidé des deux mécaniques d'acquisition de llmastro :

1. **Parrainage** — utilisateur → utilisateur, récompense en crédits / bon cadeau.
2. **Affiliation** — influenceur → utilisateur, récompense en euros, sur invitation.

Ce document est la spec de référence avant écriture de la moindre ligne de code.
Les décisions listées dans **Décisions actées** sont figées. Les **Décisions ouvertes** doivent être tranchées avant le démarrage du chantier `GROWTH-V1`.

---

## TL;DR

- Une seule plomberie partagée (capture cookie + table d'attribution), deux mécaniques distinctes au-dessus.
- Parrainage = mécanique produit, récompense en crédits (ou bon cadeau si parrain Pro), ouverte à tous.
- Affiliation = relation commerciale B2B, commission récurrente 20 % / 12 mois par défaut **personnalisable par affilié**, sur invitation, snapshot strict des conditions au moment de l'attribution.
- Conflit cookie : si un user a les deux cookies, **l'affilié encaisse** ; le filleul garde le bénéfice parrainage (trial étendu).
- Bloqueur critique non-technique : le cadre légal/fiscal côté affiliation. À démarrer en parallèle du code.

---

## Décisions actées

### Parrainage

- [P-01] Cible : tout utilisateur authentifié, indépendant du plan.
- [P-02] Récompense déclenchée à **l'activation du filleul** (1er natal créé + compte âgé de ≥ 3 jours), pas au signup.
- [P-03] Au signup du filleul (cookie `?ref=` présent et valide) : trial Essentiel étendu **7 j → 14 j**.
- [P-04] À l'activation, pack symétrique pour parrain et filleul : **10 crédits Kairos + 3 crédits tarot + 1 crédit synastry**.
- [P-05] Si le parrain est sur le plan Pro (crédits feature inutiles pour lui) : il reçoit à la place un **code "bon cadeau" 1 mois Essentiel transférable**, valable 90 jours, un seul redeem.
- [P-06] Cap : **20 parrainages récompensés par parrain glissant sur 30 jours**.
- [P-07] Anti-abus minimal : domaine email parrain ≠ filleul, IP parrain ≠ IP filleul (log uniquement, non bloquant).
- [P-08] Cookie `?ref=` : durée **30 jours**, first-party.
- [P-09] Code de parrainage : généré au signup de chaque user, format nanoid 8 caractères, exposé en clair sur `/dashboard/parrainage`.

### Affiliation

- [A-01] Cible : influenceurs astro/ésotérisme francophones, **sur invitation uniquement** au MVP.
- [A-02] Modèle de commission : **% récurrent sur N mois**, calculé sur le net encaissé HT.
- [A-03] Valeurs par défaut : **20 % pendant 12 mois**.
- [A-04] Personnalisation par affilié via un système **tier + override** :
  - Tier `standard` = 20 % / 12 mois
  - Tier `vip` = 25 % / 12 mois
  - Tier `top` = 30 % / 18 mois
  - Tier `partner` = 35 % / 24 mois
  - `commission_pct_override` et `commission_months_override` (nullable) permettent un cas-par-cas hors grille.
- [A-05] **Snapshot strict** : les conditions sont gravées sur la ligne `affiliate_attributions` au moment de l'attribution. Toute modification ultérieure du deal (tier ou override) ne touche que les futures attributions.
- [A-06] Attribution **last-touch**, déclenchée au **paiement Stripe**, pas au signup. Le `affiliate_id` est néanmoins stocké au signup pour traçabilité.
- [A-07] Cookie `?aff=` : durée **60 jours**, first-party. Format slug human-readable (ex: `luna-astro-9k2`).
- [A-08] Backup server-side : hash `(ip + ua)` enregistré dans `affiliate_clicks`, sert de signal d'attribution si le cookie est perdu.
- [A-09] Conditions d'éligibilité affilié : statut juridique (micro-entreprise minimum), SIRET, IBAN. Pas de paiement sans facture émise par l'affilié.
- [A-10] Seuil de payout : **commission cumulée ≥ 50 €**. En-dessous, report sur le mois suivant.
- [A-11] Plafond mensuel par affilié : **500 €** au MVP. Au-delà, review manuel admin avant déblocage.
- [A-12] Bornes de validation sur les conditions (anti-typo) : `commission_pct` ∈ [5, 50], `commission_months` ∈ [1, 36]. Confirmation explicite admin si modification du `commission_pct` > 10 points absolus.
- [A-13] **Self-purchase bloqué** : un affilié ne touche pas de commission sur une attribution dont `referred_user_id` correspond à son propre `user_id`.
- [A-14] **Refund / chargeback** : `affiliate_commissions.status` passe à `reversed`, montant déduit du payout courant.
- [A-15] Audit log obligatoire (`affiliate_terms_history`) sur toute modification de `tier`, `commission_pct_override`, `commission_months_override`.

### Plomberie partagée

- [G-01] Une seule logique de capture cookie côté `apps/web` (middleware Next.js) qui pose `aff_code` et `ref_code` dans deux cookies first-party distincts.
- [G-02] Une seule table d'événements d'attribution serveur (cf. schéma).
- [G-03] Règle de **conflit aff/parrainage** : si les deux cookies sont présents au signup, l'**affilié gagne** sur la commission ; le filleul conserve néanmoins son trial étendu 14 j (l'effet parrainage côté filleul est conservé ; côté parrain, aucune récompense — il perd l'attribution).
- [G-04] Priorité = ordre d'apparition (premier cookie posé gagne) en cas de conflit aff/aff ou ref/ref. Pour aff/ref croisé, voir G-03.

### Hors scope MVP

- [X-01] Pas de leaderboard public d'affiliés ni de parrainage.
- [X-02] Pas de partage social pré-rempli (Instagram, TikTok) — V2.
- [X-03] Pas d'attribution multi-touch ni de modèle d'attribution probabiliste.
- [X-04] Pas de coupon réduction pour le filleul d'un affilié — confusion avec la mécanique parrainage. V2.
- [X-05] Pas de Stripe Connect. Payout manuel sur facture jusqu'à 20+ affiliés actifs.
- [X-06] Pas d'overrides temporaires affiliation (campagnes datées). V1.5 si besoin.
- [X-07] Pas de badge "Ambassadeur" parrainage. V2, gratuit à câbler quand on saura si c'est désiré.
- [X-08] Pas de multi-niveau / MLM côté affiliation. Jamais.

---

## Décisions ouvertes

Aucune décision ouverte bloquante pour le démarrage de `GROWTH-V1` (Phase 0).

**Reportées au chantier billing Stripe** (`GROWTH-V2-STRIPE`) :

- [O-05] Stack de paiement à terme (Stripe Checkout + Subscriptions présumé). Décision repoussée au moment du branchement Stripe.

### Historique des décisions

- [O-01] **Tranché 2026-05-26** : cookie affiliation = 60 j. (Cf. A-07.)
- [O-02] **Tranché 2026-05-26** : seuil payout = 50 €. (Cf. A-10.)
- [O-03] **Tranché 2026-05-26** : plafond mensuel = 500 € / affilié au MVP. (Cf. A-11.)
- [O-04] **Tranché 2026-05-26** : page d'application affiliation publique `/affiliate` au MVP, avec formulaire. (Cf. Phase 0.)

---

## Vue d'ensemble — comparatif

|                          | Parrainage                                     | Affiliation                                        |
|--------------------------|------------------------------------------------|----------------------------------------------------|
| Qui                      | Tout user                                      | Influenceur sur invitation                         |
| Récompense parrain       | Crédits ou bon cadeau                          | € sur facture                                      |
| Récompense filleul       | Trial 14 j + crédits à l'activation            | Aucune (V2 = coupon réduction)                     |
| Déclencheur récompense   | Activation (1er natal + 3 j)                   | Paiement Stripe                                    |
| Cookie                   | `ref_code`, 30 j                               | `aff_code`, 60 j                                   |
| Cap                      | 20 récompenses / 30 j                          | 500 € / mois (au MVP)                              |
| Conflit cookies          | Perd l'attribution si aff_code présent         | Gagne sur aff_code, even if ref_code aussi présent |
| KYC                      | Aucun                                          | SIRET + IBAN + statut juridique                    |
| Surface UI               | `/dashboard/parrainage`                        | `/affiliate/dashboard` + `/admin/affiliates`       |

---

## Mécanique parrainage — détail

### Flow nominal

1. User A va sur `/dashboard/parrainage`, copie son lien `llmastro.com/?ref=AZD3X9K2`.
2. User B clique → middleware `apps/web` pose cookie first-party `ref_code=AZD3X9K2` (30 j).
3. User B s'inscrit : `POST /auth/register` reçoit `referralCode` dans le body. Le service `auth.service.ts` :
   - valide le code (existe, ≠ self, parrain non `banned`),
   - écrit `users.referred_by = A.id`,
   - insère une ligne `referrals { referrer_id: A, referred_id: B, status: 'pending' }`,
   - applique le trial 14 j Essentiel au lieu de 7 (override de `TRIAL_CONFIG.TRIAL_DAYS`).
4. Quand User B crée son premier natal (`POST /natal`), `natal.service.ts` :
   - vérifie si `B.referred_by IS NOT NULL` et `B.created_at < NOW() - INTERVAL '3 days'`,
   - si oui, marque la `referrals.status = 'activated'`,
   - schedule l'attribution des crédits (peut être inline si la requête `natal` n'est pas le hot path, sinon job).
5. `grants.service.ts` distribue le pack :
   - Pour A et B : `+10 ai.chat.credits`, `+3 tarot.credits`, `+1 synastry.credits`.
   - **Exception A est Pro** : pas de crédits, génération d'un code `gift_codes` 1 mois Essentiel valable 90 j.
   - `referrals.status = 'rewarded'`, `rewarded_at = NOW()`.

### Cas de figure

- Délai entre signup et activation > 3 j : OK, c'est le but (preuve d'intention).
- User B se désinscrit avant activation : `referrals.status = 'rejected'`, pas de crédit attribué.
- User B clique sur un lien d'affilié *après* avoir signé via un parrainage : irrelevant, l'attribution parrainage est figée au signup.
- A dépasse le cap 20/30j : les `referrals` au-delà restent `activated` mais ne déclenchent pas `grants.service`. L'historique reste consultable, A peut voir "X parrainages en attente, votre cap se libère le YYYY-MM-DD".

### Surface UI

`/dashboard/parrainage` :

- Lien à partager + bouton copier
- Compteur : invités (clics), inscrits, activés, crédits gagnés ce cycle
- Si parrain Pro : liste des bons cadeaux émis avec leur statut (`unused`, `redeemed`, `expired`)
- Si cap atteint : bandeau informatif avec date de libération

---

## Mécanique affiliation — détail

### Flow nominal

1. Influenceur candidate via `/affiliate` (formulaire → email à l'admin) ou est contacté directement.
2. Admin valide, crée une ligne `affiliates { status: 'active', tier: 'standard', slug: 'luna-astro-9k2' }` via `/admin/affiliates`.
3. KYC collecté hors-bande : SIRET, IBAN (stockés chiffrés via `pgcrypto`), CGU affiliés signées.
4. Influenceur publie son lien `llmastro.com/?aff=luna-astro-9k2`.
5. Visiteur clique → middleware `apps/web` :
   - insère ligne `affiliate_clicks { affiliate_id, visitor_hash, utm_* }`,
   - pose cookie first-party `aff_code=luna-astro-9k2` (60 j).
6. Visiteur s'inscrit : `auth.service.ts` lit le cookie, insère `affiliate_attributions { affiliate_id, referred_user_id, commission_pct, commission_months, expires_at }`.
   - **Les conditions sont snapshotées** : on appelle `resolveTerms(affiliate)` une fois pour obtenir le couple `(pct, months)` effectif au moment de l'attribution, et on l'écrit en dur.
7. Plus tard, le filleul paye un abonnement (webhook Stripe `invoice.paid`) :
   - Le webhook handler cherche une `affiliate_attributions` active (`expires_at > NOW()`) pour `user_id`.
   - Si présente, insère ligne `affiliate_commissions { affiliate_id, attribution_id, amount_cents = invoice_net * pct/100, period_month, status: 'accrued' }`.
8. Mensuellement, l'admin lance le batch payout :
   - Pour chaque affilié, somme `accrued` du mois précédent.
   - Si total ≥ 50 € : statut `invoiced` (l'affilié émet une facture), puis `paid` au virement.
   - Sinon : reporté au mois suivant.

### Tiers et résolution

```ts
// apps/api/src/config/affiliate-tiers.config.ts
export const AFFILIATE_TIERS = {
  standard: { pct: 20, months: 12 },
  vip:      { pct: 25, months: 12 },
  top:      { pct: 30, months: 18 },
  partner:  { pct: 35, months: 24 },
} as const;

export function resolveTerms(a: AffiliateRow): { pct: number; months: number } {
  const tier = AFFILIATE_TIERS[a.tier];
  return {
    pct:    a.commission_pct_override    ?? tier.pct,
    months: a.commission_months_override ?? tier.months,
  };
}
```

`resolveTerms` est appelée **uniquement** au moment de créer une `affiliate_attributions`. Une fois la ligne créée, les colonnes `commission_pct` et `commission_months` de l'attribution sont la source de vérité pour toutes les `affiliate_commissions` générées sous cette attribution.

### Garanties du snapshot strict

- Si admin passe Luna de `standard` à `top` : ses filleuls actuels restent à 20 %, les futurs auront 30 %.
- Si admin baisse Luna de `top` à `standard` : idem en miroir, les anciens conservent 30 %.
- L'admin UI doit afficher en permanence "Conditions effectives : X % / Y mois" + "Filleuls actifs sous conditions actuelles : N / M" pour rendre le snapshot lisible.

### Surface UI

`/affiliate/dashboard` (auth user avec `affiliates` row active) :

- Lien à partager + bouton copier
- Stats du mois : clics, inscriptions, conversions payantes, MRR généré, commission accrued
- Historique des paiements : mois par mois, statut (`accrued` / `invoiced` / `paid` / `reversed`)
- Bouton "Télécharger relevé mensuel" : PDF des lignes facturables à recopier sur facture micro-entreprise

`/admin/affiliates` :

- Liste des candidatures (statut `pending`)
- Liste des affiliés actifs avec tier, conditions effectives, MRR attribué, commission à payer ce mois
- Page détail (cf. mockup dans la discussion précédente)

---

## Schéma DB consolidé

Toutes les tables introduites par `GROWTH-V1`.

### Parrainage

```sql
ALTER TABLE users
  ADD COLUMN referral_code VARCHAR(12) UNIQUE,
  ADD COLUMN referred_by  UUID REFERENCES users(id);

CREATE TABLE referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES users(id),
  referred_id     UUID NOT NULL REFERENCES users(id) UNIQUE,
  status          TEXT NOT NULL CHECK (status IN ('pending','activated','rewarded','rejected')),
  activated_at    TIMESTAMPTZ,
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON referrals (referrer_id);
CREATE INDEX ON referrals (status, created_at);

CREATE TABLE gift_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20) UNIQUE NOT NULL,           -- ex: LLM-XXXX-XXXX
  issued_to     UUID REFERENCES users(id),             -- le parrain Pro
  granted_plan  TEXT NOT NULL DEFAULT 'essential',
  granted_days  INTEGER NOT NULL DEFAULT 30,
  expires_at    TIMESTAMPTZ NOT NULL,
  redeemed_by   UUID REFERENCES users(id),
  redeemed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Affiliation

```sql
CREATE TABLE affiliates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES users(id),
  slug                        VARCHAR(40) UNIQUE NOT NULL,
  display_name                TEXT NOT NULL,
  status                      TEXT NOT NULL CHECK (status IN ('pending','active','paused','banned')),
  tier                        TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','vip','top','partner')),
  commission_pct_override     INTEGER CHECK (commission_pct_override BETWEEN 5 AND 50),
  commission_months_override  INTEGER CHECK (commission_months_override BETWEEN 1 AND 36),
  legal_name                  TEXT,
  siret                       TEXT,
  iban                        BYTEA,                  -- chiffré via pgcrypto pgp_sym_encrypt
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE affiliate_clicks (
  id           BIGSERIAL PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  visitor_hash TEXT NOT NULL,                          -- sha256(ip + ua), pas de PII brute
  landing_url  TEXT,
  utm_source   TEXT, utm_medium TEXT, utm_campaign TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON affiliate_clicks (affiliate_id, created_at);

CREATE TABLE affiliate_attributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        UUID NOT NULL REFERENCES affiliates(id),
  referred_user_id    UUID NOT NULL UNIQUE REFERENCES users(id),
  commission_pct      INTEGER NOT NULL,
  commission_months   INTEGER NOT NULL,
  attributed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON affiliate_attributions (affiliate_id);
CREATE INDEX ON affiliate_attributions (expires_at) WHERE expires_at > NOW();

CREATE TABLE affiliate_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      UUID NOT NULL REFERENCES affiliates(id),
  attribution_id    UUID NOT NULL REFERENCES affiliate_attributions(id),
  amount_cents      INTEGER NOT NULL,
  period_month      DATE NOT NULL,                    -- 1er du mois
  status            TEXT NOT NULL CHECK (status IN ('accrued','invoiced','paid','reversed')),
  stripe_charge_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON affiliate_commissions (affiliate_id, status, period_month);

CREATE TABLE affiliate_terms_history (
  id              BIGSERIAL PRIMARY KEY,
  affiliate_id    UUID NOT NULL REFERENCES affiliates(id),
  changed_by      UUID REFERENCES users(id),
  previous_tier   TEXT,
  previous_pct    INTEGER,
  previous_months INTEGER,
  new_tier        TEXT,
  new_pct         INTEGER,
  new_months      INTEGER,
  reason          TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON affiliate_terms_history (affiliate_id, changed_at);
```

### Notes d'intégration côté code

- Tables Drizzle à ajouter dans `apps/api/src/db/schema.ts`.
- Migration SQL dans `apps/api/src/db/migrations/NNN_growth_v1.sql`.
- Nouveau service `apps/api/src/services/growth.service.ts` qui exporte :
  - `captureReferral(req, registerInput)` — appelé depuis `auth.service.ts` au register
  - `captureAffiliate(req, registerInput)` — idem, avec la règle de conflit G-03
  - `tryActivateReferral(userId)` — appelé depuis `natal.service.ts` à la création du 1er natal
  - `resolveTerms(affiliate)` — la fonction du tier + override
  - `accrueCommission(invoice)` — handler du webhook Stripe `invoice.paid`
  - `reverseCommission(invoice)` — handler `invoice.payment_failed` / refund
- Réutilise `grants.service.ts` existant pour pousser les crédits parrainage.
- Réutilise `subscriptions.service.ts` existant pour l'extension de trial (à étendre avec un `applyTrial(userId, days)`).
- Nouvelle route `apps/api/src/routes/growth.ts` qui sert `/referrals/me`, `/referrals/me/stats`, `/affiliate/me`, `/affiliate/me/stats`.
- Routes admin sous `apps/api/src/routes/admin-panel.ts` (existant) pour `/admin/affiliates`.

---

## Cadre légal / fiscal — checklist bloquante

**Décision 2026-05-26** : la rédaction CGU et le cadre fiscal sont **différés**, repris ultérieurement.

**Conséquence opérationnelle stricte** : Phase 0 (cookies, attributions, dashboards, UI marketing) peut démarrer immédiatement — rien ne paye encore. Phase 1 (webhooks Stripe → accrual des commissions) peut aussi démarrer : on peut *calculer* et stocker les commissions en statut `accrued` sans CGU. **Le seul interdit absolu : le passage `accrued → invoiced` puis `invoiced → paid` sans cadre légal en place.** Concrètement, ne déclencher aucun virement à un affilié tant que cette checklist n'est pas validée :

- [ ] Rédaction des CGU affiliés (cf. modèles AffiliateWP / Awin pour inspiration ; mentions obligatoires loi du 9 juin 2023 sur les influenceurs).
- [ ] Clause sur l'obligation de mention `#partenariatrémunéré` ou `#publicité` dans chaque post promotionnel — non-respect = résiliation immédiate + clawback des commissions du mois en cours.
- [ ] Procédure de collecte SIRET + IBAN + attestation de statut, formulaire à intégrer à la candidature.
- [ ] Modèle de facture pro-forma à fournir à l'affilié (génération PDF côté admin, l'affilié recopie sur sa propre facture).
- [ ] Vérification fiscale : TVA applicable ou non selon statut (micro = pas de TVA jusqu'à seuil franchise).
- [ ] Stockage IBAN chiffré (`pgcrypto`, clé hors DB, rotation documentée dans `SECURITY.md`).
- [ ] Politique de rétention des données affiliés (5 ans après dernière commission par défaut, à clarifier avec un comptable).

---

## Séquencement

### Phase 0 — Pré-Stripe (buildable dès aujourd'hui)

Objectif : poser toute la plomberie cookie + attribution + dashboard sans dépendre du paiement réel.

- Migration SQL `NNN_growth_v1.sql` (toutes les tables ci-dessus).
- Capture cookies `?ref=` et `?aff=` dans `apps/web` middleware.
- Endpoints `/referrals/*` et `/affiliate/me/*`.
- Page `/dashboard/parrainage` (UI complète).
- Page `/affiliate/dashboard` (UI complète, stats à 0 tant que pas de Stripe).
- Page `/affiliate` marketing + formulaire d'application.
- Admin `/admin/affiliates`.
- Hook activation parrainage dans `natal.service.ts`.
- Génération bons cadeaux + endpoint `/auth/redeem-gift`.

Critère de complétion : un nouvel inscrit via `?ref=` voit son trial à 14 j ; les deux comptes voient leurs crédits incrémenter après création du 1er natal + 3 j.

### Phase 1 — Avec Stripe (quand le billing sera branché)

Objectif : activer le calcul automatique des commissions affiliation.

- Webhook Stripe `invoice.paid` → `accrueCommission()`.
- Webhook `invoice.payment_failed` / `charge.refunded` → `reverseCommission()`.
- Batch mensuel admin : "Générer les relevés du mois M-1" → passe les `accrued` → `invoiced` après vérif.
- Génération PDF des relevés.

Critère de complétion : un filleul d'un affilié `top` qui paie 9,90 € Essentiel génère une ligne `affiliate_commissions` à 2,97 € (9,90 × 30 % à 18 mois).

### Phase 2 — Scale (> 20 affiliés actifs)

Objectif : réduire la charge admin du payout.

- Option A : Stripe Connect Express. KYC géré par Stripe, payout auto, mais lourd côté affilié.
- Option B : automatisation génération facture + envoi email + virement SEPA par batch CSV.

Décision à prendre au moment voulu, **pas avant**. Pas de pré-câblage côté code.

---

## Garde-fous et anti-abus

| Risque                              | Mitigation MVP                                                | Mitigation V2                  |
|-------------------------------------|---------------------------------------------------------------|--------------------------------|
| Comptes jetables côté parrainage    | Récompense à l'activation, pas au signup                      | Vérif email + check device     |
| Self-referral (parrain = filleul)   | `referrer_id != referred_id` enforced côté insert             | -                              |
| Self-purchase côté affiliation      | `affiliate.user_id != referred_user_id`                       | -                              |
| Fraude carte côté affiliation       | `reverseCommission` automatique sur chargeback/refund         | Hold 30 j avant payout         |
| Spam de codes parrainage            | Cap 20 récompenses / 30 j glissants                           | Rate limit endpoint applique   |
| Affilié toxique (vol de search)     | Plafond 500 € / mois, review manuel                           | Détection patterns IP / device |
| Modification accidentelle deal      | Bornes [5,50]% / [1,36] mois + confirmation > 10 pts          | -                              |
| Cookie 3rd party meurt              | Backup hash IP+UA côté serveur dans `affiliate_clicks`        | Fingerprint client-side        |
| Conflit aff vs ref                  | Règle G-03 explicite, codée une seule fois dans `growth.service` | -                            |

---

## Conventions de patch

Suit la convention `PATCH-X-Y` de ce repo (cf. `CLAUDE.md`). Le chantier complet est `GROWTH-V1`. Sous-patches attendus :

- `GROWTH-V1-DB` — migration + schema Drizzle
- `GROWTH-V1-CAPTURE` — middleware cookies + endpoints register
- `GROWTH-V1-PARRAINAGE-UI` — `/dashboard/parrainage`
- `GROWTH-V1-AFFILIATE-UI` — `/affiliate/dashboard` + `/affiliate`
- `GROWTH-V1-ADMIN` — `/admin/affiliates`
- `GROWTH-V1-ACTIVATION-HOOK` — hook dans `natal.service.ts`
- `GROWTH-V1-GIFT-CODES` — bons cadeaux Pro
- `GROWTH-V2-STRIPE` — webhooks (séparé, car dépend du chantier Stripe)

Chaque patch laisse son marqueur `# GROWTH-V1-X applied` en fin de fichier touché + marqueur racine `.GROWTH-V1-X-APPLIED`, idempotent.

---

## Références code existant à réutiliser

- `apps/api/src/services/grants.service.ts` — pour pousser crédits parrainage.
- `apps/api/src/services/subscriptions.service.ts` — pour étendre le trial (méthode à ajouter).
- `apps/api/src/services/entitlements.service.ts` — pour lire le plan du parrain (détection Pro).
- `apps/api/src/services/natal.service.ts` — pour brancher le hook d'activation.
- `apps/api/src/services/auth.service.ts` — pour brancher la capture au register.
- `apps/api/src/config/plans.config.ts` — feature keys déjà présentes pour les crédits (`ai.chat.credits`, `tarot.credits`, `synastry.credits`).
- `apps/api/src/middleware/auth.middleware.ts` — pattern à reproduire pour `/affiliate/*` protégé.

Aucun service existant n'a besoin d'être réécrit ; tous sont étendus de manière additive.
