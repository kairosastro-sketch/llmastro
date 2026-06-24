# Sign in with Apple — setup (OAUTH-APPLE-V1)

Le code est livré et **inactif par défaut** : le bouton « Continuer avec Apple »
n'apparaît sur les pages login/register que lorsque les 5 variables d'env Apple
sont posées sur le VPS (l'endpoint `GET /auth/providers` les détecte).

Prérequis : **Apple Developer Program** (99 $/an).

## 1. Récupérer le Team ID
Apple Developer → Membership → **Team ID** (10 caractères, ex. `ABCDE12345`).

## 2. Créer un App ID (si pas déjà fait)
Certificates, IDs & Profiles → Identifiers → **+** → **App IDs** → App.
Activer la capability **Sign in with Apple**.

## 3. Créer un Services ID (= le `client_id`)
Identifiers → **+** → **Services IDs**.
- Description libre, Identifier ex. `com.llmastro.signin` → **APPLE_SERVICE_ID**.
- Cocher **Sign in with Apple** → Configure :
  - Primary App ID = l'App ID de l'étape 2.
  - **Domains and Subdomains** : `llmastro.com`
  - **Return URLs** : `https://llmastro.com/api/auth/apple/callback`
- Apple exige de **vérifier le domaine** (fichier `apple-developer-domain-association.txt`
  à servir sous `/.well-known/` — me prévenir, je l'ajoute à Caddy si besoin).

## 4. Créer une Key (.p8)
Keys → **+** → cocher **Sign in with Apple** → Configure (Primary App ID) → Register.
- Télécharger le fichier `AuthKey_XXXXXXXXXX.p8` (**une seule fois**, irrécupérable).
- Le **Key ID** (10 caractères) = **APPLE_KEY_ID**.

## 5. Poser les variables d'env sur le VPS
Dans `/opt/astro-platform/.env.local` :

```
APPLE_SERVICE_ID=com.llmastro.signin
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...contenu du .p8...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL=https://llmastro.com/api/auth/apple/callback
```

> `APPLE_PRIVATE_KEY` : le contenu du `.p8`. Les `\n` échappés sont acceptés
> (le service les restaure). Garder les guillemets.

Puis :
```
cd /opt/astro-platform
docker compose -f docker-compose.prod.yml restart api
```

## 6. Vérifier
- `GET https://llmastro.com/api/auth/providers` → `apple: true`.
- Le bouton « Continuer avec Apple » apparaît sur /auth/login et /auth/register.
- Tester le flow complet (le `client_secret` JWT est régénéré à chaque échange,
  validité 180 j — rien à renouveler manuellement).

## Notes techniques
- `client_secret` = JWT **ES256** signé à la volée avec la `.p8` (Team/Key/Service ID).
- Callback en **POST `form_post`** (Apple l'impose dès qu'on demande name+email) ;
  cookie state en `SameSite=None;Secure`.
- Le **nom** n'est transmis qu'à la **toute première** autorisation (champ `user`).
  Apple ne fournit pas d'avatar.
- Option « Hide My Email » : Apple renvoie alors un relais `@privaterelay.appleid.com`
  — géré comme un email normal (vérifié).
