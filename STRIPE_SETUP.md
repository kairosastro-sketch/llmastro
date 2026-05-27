# STRIPE_SETUP.md — STRIPE-MVP-V1

Handoff pour activer le paiement Essentiel sur LLMastro.

Le code (API + web) est déjà branché. Il reste à **créer le produit Stripe**, **configurer les trois env vars**, et **rebooter l'API**. Ce doc liste les étapes dans l'ordre, test mode puis live.

---

## TL;DR

```
.env.local (et VPS prod : .env.local sur /opt/astro-platform)
  STRIPE_SECRET_KEY=sk_test_xxx              # ou sk_live_xxx en prod
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  STRIPE_PRICE_ESSENTIAL_MONTHLY=price_xxx
```

Reboot API : `docker compose -f docker-compose.prod.yml restart api` (prod) ou relancer `pnpm dev` (local).

---

## 1. Test mode — dev local

### 1.1 Créer le produit + prix

1. Dashboard Stripe (test mode) → **Products** → **+ Add product**
2. Name : `Essentiel`
3. Description (facultatif) : `Abonnement mensuel LLMastro Essentiel`
4. Pricing :
   - **Recurring** · `9,90 EUR` · **Monthly**
   - Tax behavior : "Exclusive" (TVA non incluse) ou "Inclusive" selon ton choix fiscal
5. **Save product**. Note le `price_…` affiché — c'est `STRIPE_PRICE_ESSENTIAL_MONTHLY`.

### 1.2 Récupérer la clé secrète

Dashboard → **Developers** → **API keys** → **Secret key** (revealer la valeur `sk_test_…`).

### 1.3 Configurer le webhook (CLI Stripe — recommandé en dev)

```bash
# Installer une fois : https://docs.stripe.com/stripe-cli
stripe login
stripe listen --forward-to http://localhost:4000/subscriptions/webhook
```

Le CLI imprime un `whsec_…` au démarrage : c'est `STRIPE_WEBHOOK_SECRET`. La session reste ouverte tant que `stripe listen` tourne.

Events forwardés par défaut : tous. Notre handler s'intéresse à :
- `checkout.session.completed`
- `customer.subscription.created` / `updated` / `deleted`
- `invoice.payment_failed`

### 1.4 Remplir `.env.local`

```env
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_ESSENTIAL_MONTHLY=price_…
```

### 1.5 Rebooter et tester

```bash
pnpm --filter @astro-platform/api dev
```

Au boot, regarde le log : `[seedPlans] plans=3 …` confirme que la colonne `stripe_price_id` du plan `essential` a été remplie depuis l'env.

Flow de test :
1. Inscris-toi sur `http://localhost:3000/auth/register` (ou utilise un compte test)
2. Va sur `/pricing` → bouton **S'abonner** sur la carte Essentiel
3. Sur Checkout Stripe, utilise une carte test : `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC, n'importe quel code postal.
4. Tu es redirigé sur `/subscriptions/success?session_id=…`. Le log API affiche `[stripe-webhook] checkout.completed → plan switched`.
5. `/dashboard/account` → la carte "Mon abonnement" affiche **Essentiel** + bouton **Gérer mon abonnement** (qui ouvre le Customer Portal Stripe).
6. Annule depuis le portail → le webhook `customer.subscription.deleted` repasse le user en `free`/`canceled`.

Cartes de test utiles (toutes valides en test mode) :
- `4242 4242 4242 4242` — succès
- `4000 0000 0000 9995` — décliné (insufficient funds)
- `4000 0027 6000 3184` — 3DS challenge

---

## 2. Production

### 2.1 Activer le Customer Portal

Dashboard Stripe → **Settings** → **Billing** → **Customer portal** → **Activate test link** puis dupliquer côté live.

Features à activer (recommandé MVP) :
- ✅ Payment methods : "Allow customers to update"
- ✅ Subscriptions : "Allow customers to cancel" (avec "Immediately" ou "End of period" selon ta politique)
- ✅ Invoice history
- ⛔ Plan switching : OFF tant qu'il n'y a qu'un seul plan payant

### 2.2 Créer le produit en mode **live**

Même flow que 1.1, mais dans **live mode**. Le `price_…` live est **différent** du test.

### 2.3 Créer le webhook prod (Dashboard, pas CLI)

Dashboard → **Developers** → **Webhooks** → **+ Add endpoint**
- URL : `https://llmastro.com/api/subscriptions/webhook`
- Events à sélectionner :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Après création : **Reveal signing secret** → `whsec_…` (différent du dev).

### 2.4 Mettre à jour `.env.local` sur le VPS

```bash
ssh vps
cd /opt/astro-platform
nano .env.local
# remplis :
# STRIPE_SECRET_KEY=sk_live_…
# STRIPE_WEBHOOK_SECRET=whsec_… (celui de l'endpoint webhook prod)
# STRIPE_PRICE_ESSENTIAL_MONTHLY=price_… (le price live)

docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml logs -f api | head -50
# Vérifier : "[seedPlans] plans=3 entitlements=… users_backfilled=…"
```

### 2.5 Smoke test live

Effectue un vrai paiement de 9,90€ depuis ton propre compte (rembourse-toi via le Customer Portal immédiatement) pour vérifier que :
- Stripe accepte la carte
- Le webhook arrive sur le VPS (Dashboard → Webhooks → **Recent events** = ✓)
- `/dashboard/account` montre Essentiel

---

## 3. Comportement quand l'env est vide

Le code tourne en mode "Stripe désactivé" tant que `STRIPE_SECRET_KEY` est vide :
- `POST /subscriptions/checkout` → `503 STRIPE_NOT_CONFIGURED`
- `POST /subscriptions/portal` → `503 STRIPE_NOT_CONFIGURED`
- `POST /subscriptions/webhook` → `503` (Stripe re-postera plus tard)
- Le bouton **S'abonner** sur `/pricing` affiche le message "L'abonnement n'est pas encore activé."

C'est volontaire : tu peux merger ce code en main sans casser prod, tant que Stripe n'est pas branché.

---

## 4. Surface backend exposée

| Méthode | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/subscriptions/plans`        | non | Catalogue public |
| `GET`  | `/subscriptions/plans/:code`  | non | Un plan + entitlements |
| `GET`  | `/subscriptions/me`           | oui | Ma subscription + entitlements |
| `POST` | `/subscriptions/checkout`     | oui | Crée Checkout session → `{ url }` |
| `POST` | `/subscriptions/portal`       | oui | Crée Customer Portal session → `{ url }` |
| `POST` | `/subscriptions/webhook`      | sig | Endpoint webhook (raw body, Stripe-Signature) |
| `POST` | `/subscriptions/dev/set-plan` | oui | Dev only, garde `DEV_PLAN_SWITCH=true` |

Le webhook met à jour `user_subscriptions` via `subscriptionsService.setPlan(...)` — même fonction que le dev set-plan, donc l'invalidation cache Redis et la propagation entitlements sont déjà câblées.

---

## 5. Ce que ce MVP **ne fait pas** (volontairement)

- ❌ Plan Pro (premium) — reste mailto contact, pricing "Sur mesure"
- ❌ Commission affiliation au paiement — voir `GROWTH_PLAN.md` [A-06], chantier séparé
- ❌ Annual billing — un seul price mensuel pour l'instant
- ❌ Coupons / promo codes côté API — `allow_promotion_codes: true` est activé sur Checkout, donc les codes promo créés dans Stripe fonctionnent, mais on n'a pas notre propre table
- ❌ Tax automatique — `automatic_tax: false`. À activer (`{ enabled: true }` dans `stripe.service.ts`) une fois Stripe Tax configuré côté Dashboard

---

## 6. Rollback d'urgence

Si quelque chose tourne mal en prod, vide `STRIPE_SECRET_KEY` et reboot l'API : tout retombe en mode désactivé sans casser les abonnements existants en DB (la table `user_subscriptions` reste, les entitlements aussi). Les paiements déjà encaissés restent valides ; seules les nouvelles tentatives sont bloquées avec un message clair.

# STRIPE-MVP-V1 applied
