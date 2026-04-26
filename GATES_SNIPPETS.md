# Guide d'intégration — Gates sur les routes métier

Ce fichier explique comment brancher les middlewares `requireEntitlement` et `requireQuota` (livrés dans l'archive 3) sur tes routes métier existantes. C'est ce qui transforme le backend tiers "plombé mais passif" en backend tiers "actif" une fois `ENTITLEMENTS_ENFORCED=true`.

## Principe

Deux types de gates selon le cas :

- **`requireEntitlement(featureKey)`** — pour une feature booléenne (accès accordé/refusé sans consommation)
- **`requireQuota(featureOrBundle)`** — pour une feature avec consommation (incrémente un compteur)

Les deux se placent dans `preHandler` de la route, **après** `authMiddleware`.

## Template de base

```ts
// apps/api/src/routes/<ta-route>.ts
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireEntitlement, requireQuota } from "../middleware/entitlements.middleware.js";

fastify.post("/chemin", {
  preHandler: [authMiddleware, requireQuota("ai.chat")],     // ou requireEntitlement(...)
  schema: { /* ... */ },
}, async (req, reply) => {
  // handler habituel
});
```

Une fois la consommation faite via `requireQuota`, tu peux lire `req.quotaResult` pour exposer les infos restantes dans la réponse :

```ts
async (req, reply) => {
  // ... ton traitement
  const quotaResult = (req as any).quotaResult;
  return reply.send({
    success: true,
    data: {
      result:    monResultatMetier,
      remaining: quotaResult?.remaining ?? null,
      source:    quotaResult?.source    ?? null,  // "quota" | "credit"
    },
  });
}
```

## Mapping recommandé route → feature_key

Voici la liste à appliquer pour couvrir le freemium de l'archive 3. **Adapte les chemins de routes** si les tiens diffèrent.

### IA (chat Kairos)

```ts
// POST /ai/chat ou /kairos/chat
{
  preHandler: [authMiddleware, requireQuota("ai.chat")],
}
```
- `ai.chat` est un **bundle** : consomme d'abord le quota journalier (`ai.chat.daily`), puis les crédits achetés (`ai.chat.credits`).

### IA — Lecture natale complète

```ts
// POST /ai/natal-reading ou équivalent (action lourde : 1 par mois sur Essential)
{
  preHandler: [authMiddleware, requireQuota("ai.natal_reading")],
}
```

### Tarot

```ts
// POST /tarot/draw (tirage standard)
{
  preHandler: [authMiddleware, requireQuota("tarot")],
}

// POST /tarot/spreads/:type (tirages avancés type tree of life, etc.)
{
  preHandler: [authMiddleware, requireEntitlement("tarot.spreads_all"), requireQuota("tarot")],
}
```

### Synastrie

```ts
// POST /synastry (nouveau calcul)
{
  preHandler: [authMiddleware, requireQuota("synastry")],
}

// GET /synastry/:id (relecture d'un calcul déjà fait) → pas de gate, c'est acquis
```

### Horoscope

```ts
// GET /horoscope/weekly
{
  preHandler: [authMiddleware, requireEntitlement("horoscope.weekly")],
}

// GET /horoscope/monthly
{
  preHandler: [authMiddleware, requireEntitlement("horoscope.monthly")],
}

// GET /horoscope/yearly
{
  preHandler: [authMiddleware, requireEntitlement("horoscope.yearly")],
}

// GET /horoscope/daily  → pas de gate, accessible à tous
```

### Transits

```ts
// GET /transits/biwheel  ou  POST /transits/compare
{
  preHandler: [authMiddleware, requireEntitlement("transits.biwheel")],
}
```

Pour `transits.forecast_days` (limite de N jours glissants) : **pas de middleware standard**, tu dois valider dans le handler :

```ts
fastify.get("/transits/forecast", {
  preHandler: [authMiddleware],
}, async (req, reply) => {
  const ent = await entitlementsService.getEntitlement(req.authContext!.userId, "transits.forecast_days");
  const max = typeof ent?.value === "number" ? ent.value : 7;

  const requested = Number((req.query as any).days ?? 7);
  const days = Math.min(requested, max);   // cap silencieux
  // ... calcul sur `days`
});
```

### Natal profiles (limite de stock)

Plafond sur `natal.profiles.max`. À vérifier **dans le handler de création** :

```ts
fastify.post("/natal/profiles", {
  preHandler: [authMiddleware],
}, async (req, reply) => {
  const userId = req.authContext!.userId;
  const ent = await entitlementsService.getEntitlement(userId, "natal.profiles.max");
  const max = typeof ent?.value === "number" ? ent.value : 1;

  if (max !== -1) {
    const current = await db.select({ id: natalData.id })
      .from(natalData).where(eq(natalData.userId, userId));
    if (current.length >= max) {
      return reply.code(403).send({
        success: false,
        error: {
          code: "FEATURE_NOT_AVAILABLE",
          message: `Tu as atteint le maximum de ${max} profils. Passe à un plan supérieur pour en créer plus.`,
          feature: "natal.profiles.max",
        },
      });
    }
  }
  // ... création normale
});
```

Le code `FEATURE_NOT_AVAILABLE` déclenchera automatiquement le paywall côté front (via l'error-bus).

### Reports

```ts
// POST /reports/generate
{
  preHandler: [authMiddleware, requireQuota("reports")],
}

// POST /reports/export-pdf
{
  preHandler: [authMiddleware, requireEntitlement("reports.export_pdf")],
}
```

### Features sans gate

- `GET /natal/chart`, `GET /natal/wheel` — toutes ces features sont dans tous les plans (sauf `natal.aspects_advanced` qui est Premium uniquement, donc `requireEntitlement("natal.aspects_advanced")` sur l'endpoint qui renvoie les aspects harmoniques/mineurs si tu en as un).
- `GET /horoscope/daily` — gratuit.
- Les routes techniques (`/health`, `/auth/*`, `/subscriptions/*`) — pas de gate métier.

## Activation de l'enforcement

Tant que `ENTITLEMENTS_ENFORCED=false`, les middlewares **loguent mais laissent passer** :

```
[entitlements] would deny  { userId: "...", featureKey: "synastry.monthly" }
[entitlements] would block { userId: "...", featureOrBundle: "ai.chat", reason: "quota_exceeded" }
```

Quand tu es sûr que tout fonctionne, édite `/opt/astro-platform/.env` (ou l'équivalent chez toi) :

```bash
ENTITLEMENTS_ENFORCED=true
```

Puis restart sans rebuild :
```bash
cd /opt/astro-platform
docker compose -f docker-compose.prod.yml restart api
```

## Vérification manuelle

Une fois l'enforcement actif, tu peux tester avec un compte `free` :

```bash
# Récupère un token (compte free)
TOKEN=$(curl -sX POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ton-compte-free@exemple.com","password":"xxx"}' | jq -r '.data.tokens.accessToken')

# Tentative d'accès à une feature Premium → doit renvoyer 403
curl -iX GET "http://localhost:4000/horoscope/monthly" \
  -H "Authorization: Bearer $TOKEN"
# → HTTP/1.1 403
# → {"success":false,"error":{"code":"FEATURE_NOT_AVAILABLE","feature":"horoscope.monthly",...}}

# Spam le quota ai.chat jusqu'à atteindre 10 (pour plan free)
for i in $(seq 1 11); do
  curl -sX POST "http://localhost:4000/ai/chat" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' \
    -w "%{http_code}\n" -o /dev/null
done
# → les 10 premiers renvoient 200, le 11e renvoie 429
```

## Helper dev pour tester les parcours Premium

L'archive 4 ajoute aussi un endpoint dev-only `POST /subscriptions/dev/set-plan` :

```bash
# Dans .env côté API
DEV_PLAN_SWITCH=true

# Puis :
curl -X POST http://localhost:4000/subscriptions/dev/set-plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode":"premium"}'
```

Le user bascule immédiatement en Premium (plus aucune limite). Pour revenir :

```bash
curl -X POST http://localhost:4000/subscriptions/dev/set-plan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode":"free"}'
```

**À retirer en prod** (ou laisser désactivé via `DEV_PLAN_SWITCH=false`) une fois Stripe en place.
