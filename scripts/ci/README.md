# scripts/ci — Garde-fous CI

Scripts de lint et test exécutables localement et idéalement en CI.

## Lints frontend (statiques, rapides)

### `lint-css-vars.mjs`

Parse `apps/web/src/app/globals.css` pour la liste des CSS custom properties
déclarées (`--xxx: ...;`), puis scanne tous les `.tsx|.ts|.css` de
`apps/web/src/` et `apps/web/tailwind.config.ts` à la recherche de références
`var(--xxx)`. Le script échoue si une référence sans fallback n'est pas
déclarée.

**Whitelist** : `--tw-*` (Tailwind internals) et `--next-*` (Next.js
internals). Les références avec fallback `var(--xxx, default)` sont tolérées
(elles sont assumées passées par inline style ou contexte local).

**Usage** :

```bash
pnpm lint:css-vars
# ou
node scripts/ci/lint-css-vars.mjs
```

### `lint-forbidden-classes.mjs`

Scanne `apps/web/src/**/*.{tsx,jsx,ts,js}` pour des classes CSS blacklistées
utilisées dans `className=`. Les classes interdites sont des classes
historiquement réintroduites par mégarde et qui n'existent pas dans le design
system actuel.

**Liste noire** : `input`, `label`, `form-error`, `form-hint`, `glass`,
`btn-primary`, `text-mist`.

**Cas couverts** :
- `className="..."` (string)
- `className='...'` (string)
- `className={"..."}` ou `className={'...'}`
- `` className={`...`} `` (template literal — parties statiques uniquement)

**Cas non couverts** (PR future) : `clsx()`, `cn()`, `twMerge()` — requiert
un parser JSX, pas juste de la regex.

**Usage** :

```bash
pnpm lint:forbidden-classes
# ou
node scripts/ci/lint-forbidden-classes.mjs
```

## Tests d'intégration

### `fresh-db-test.sh`

Prouve qu'une **DB Postgres vide** peut booter intégralement avec le code
actuel. Aurait évité la classe d'erreurs SCHEMA-COHERENCE-V1.

**Stratégie** : spin up des containers Docker temporaires sur un réseau
isolé (postgres + neo4j + redis + l'image API locale), attend que le boot
init de l'API applique ses migrations, vérifie que le schéma final contient
les tables attendues, puis nettoie tout.

**Tables CORE** vérifiées (le test fail si une manque) :
- `users`
- `natal_profiles`
- `chat_conversations`
- `chat_messages`

**Tables OPTIONAL** (warning si absentes) :
- `sessions`
- `refresh_tokens`
- `email_verifications`

Adapter les listes en haut du script si le schéma évolue.

**Usage** :

```bash
pnpm test:fresh-db
# ou
bash scripts/ci/fresh-db-test.sh
```

**Préconditions** :
- Image API construite localement : `docker compose -f docker-compose.prod.yml build api`
- Suffisamment de RAM libre pour 4 containers temporaires (~1.5 GB)

**Variables d'env optionnelles** :
- `FRESH_DB_API_IMAGE=...` : image API à utiliser (défaut: `astro-platform-api:latest`)
- `FRESH_DB_BOOT_TIMEOUT=120` : timeout boot en secondes (défaut: 60)
- `FRESH_DB_KEEP=1` : ne nettoie pas les containers (debug — penser à les rm manuellement)

**Limites** :
- Test "schéma only" — ne valide pas les opérations CRUD HTTP. Une V2 pourrait
  ajouter signup/login/create natal/chat via curl.
- Le script utilise `astro-platform-api:latest` — la véritable image qui tourne
  en prod. Si l'image diverge du code actuel, faire un build préalable.

## Combiné

```bash
pnpm lint:ci   # = lint:css-vars && lint:forbidden-classes
```

## Limites connues (générales)

- Les scripts sont en **Node natif** (aucune dépendance npm). Volontaire pour
  pouvoir les lancer dans le moindre environnement, y compris depuis le VPS
  sans `pnpm install`.
- Pas de parser AST → quelques faux négatifs sur les expressions complexes
  (`clsx`, `cn`, ternaires imbriqués). C'est volontaire : 80% du bénéfice
  pour 20% du coût.
- L'argument optionnel des scripts est le `REPO_ROOT` (par défaut `.`). Utile
  pour tester depuis n'importe quel `cwd`.
