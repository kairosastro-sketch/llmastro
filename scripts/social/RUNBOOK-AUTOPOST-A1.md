# Runbook — A1 : auto-publication du « ciel du jour » (Metricool)

> 🆕 **Version full-API serveur disponible** : voir `RUNBOOK-AUTOPOST-API-A1.md`
> (publication directe depuis le VPS, zéro geste hebdo, **sans Page Facebook**).
> Ce runbook Metricool reste valable comme repli manuel — mais sa consigne
> « Page Facebook reliée requise » (Étape 0) **ne s'applique pas** au chemin API.

Publier chaque jour le post image « ciel du jour » sur **Instagram + Pinterest**,
en **semi-auto** : génération 100 % automatique (déjà en place), mise en file
1×/semaine dans Metricool qui publie tout seul.

> Effort récurrent cible : **~15 min le dimanche**. Aucune clé API, aucun dev.

---

## Étape 0 — Prérequis comptes (à faire UNE fois) ⚠️ bloquant

L'auto-publication est impossible avec des comptes personnels (limite des API, pas de l'outil).

- [ ] **Instagram en compte Pro** (Business ou Créateur) — Réglages IG → Compte →
      « Passer à un compte professionnel ». Gratuit, réversible.
- [ ] **Page Facebook reliée** à ce compte IG (requis par l'API Meta même si tu ne
      postes pas sur FB). Créer une Page vide « llmastro » suffit.
- [ ] **Pinterest en compte Business** — gratuit, conversion dans les réglages Pinterest.
      Créer au moins 2 tableaux : « Ciel du jour » et « Astrologie / pédagogie ».

Tant que ces 3 cases ne sont pas cochées, Metricool ne pourra pas publier.

---

## Étape 1 — Metricool (à faire UNE fois)

1. [ ] Créer un compte Metricool (plan gratuit) → 1 marque « llmastro ».
2. [ ] **Connecter Instagram** (via la connexion Facebook, choisir le compte Pro + la Page).
3. [ ] **Connecter Pinterest** (compte Business).
4. [ ] (Option) **Connecter TikTok** — utile plus tard pour le Volet A2 vidéo.
5. [ ] Instagram : compte FB refusé → publier en mode **notification** (1 tap/jour,
       sans Facebook). Vérifier que l'appli mobile Metricool est installée + notifs autorisées.

> **Plan gratuit Metricool plafonné** : on ne charge dans Metricool que **Pinterest + IG**.
> **X / Twitter** se planifie via son **planificateur natif gratuit** (pas Metricool).
> TikTok (Volet A2) aura aussi son planificateur natif. → aucun passage au payant.

---

## Étape 2 — La génération (déjà automatisée, rien à faire)

La tâche planifiée Windows produit chaque matin :

```
scripts/social/out/YYYY-MM-DD/
  ├─ ciel-day-YYYY-MM-DD.png   ← visuel 1080×1350 (parfait feed IG)
  └─ caption-day.txt           ← caption FR + hashtags + CTA
```

Vérifier qu'elle tourne : `schtasks /Query /TN "Llmastro-DailyPost"`.
(Si absente, voir `README.md` § Automatisation pour la recréer.)

---

## Étape 3 — La mise en file hebdo (~15 min le dimanche)

Pour chacun des 7 jours de la semaine à venir, dans Metricool → Planning :

1. [ ] **Nouveau post** → sélectionner **Instagram + Pinterest** en même temps.
       (**X** : à planifier séparément via le planificateur natif de x.com — icône calendrier,
       coller `x-day.txt` + image. Gratuit, hors Metricool.)
2. [ ] Glisser le `ciel-day-*.png` du jour.
3. [ ] Coller le contenu de `caption-day.txt` :
       - **Instagram** : caption complète telle quelle (hashtags inclus, 3–8 suffisent).
       - **Pinterest** : titre court accrocheur (« Le ciel du [jour] », max 100 car.) +
         description **≤ 800 caractères** (la `caption-day.txt` complète dépasse → la
         tronquer : fait du jour + 3 aspects + 1–2 phrases de lecture IA + 1 ligne de
         mots-clés recherchés « astrologie / horoscope du jour / transits / pleine lune /
         signes du zodiaque / thème natal »). Pinterest est un moteur de recherche : les
         mots-clés comptent plus que les hashtags. Mettre le **lien** `llmastro.com/ciel`
         à la fois dans le texte ET dans le champ « Lien de destination » du pin (clé :
         c'est lui qui renvoie le trafic).
       - **X / Twitter** (recyclage, secondaire) : **280 caractères max** (la caption
         complète dépasse → version courte : titre + 2-3 aspects condensés + 1 phrase +
         lien + **1 seul hashtag**). L'URL compte pour 23 car. quel que soit sa longueur.
         Même visuel que les autres.
       - Choisir le **tableau** Pinterest « Ciel du jour ».
4. [ ] Programmer l'heure (voir grille ci-dessous).
5. [ ] Répéter pour les 7 jours, puis vérifier le calendrier de la semaine.

> Astuce : génère la semaine d'avance en lançant `daily-post.mjs` plusieurs fois
> n'est pas possible pour des dates futures (l'API renvoie le ciel courant) → en
> pratique tu mets en file au fil de l'eau, ou tu utilises `--cadence week` pour un
> post hebdo unique le lundi + des posts quotidiens ajoutés chaque matin. Le plus
> simple au démarrage : **programmer la veille pour le lendemain**, 1 min/jour.

---

## Grille horaire (audience FR)

Heures qui marchent le mieux en France (à affiner avec tes analytics Metricool après 2 sem.) :

| Réseau | Créneaux |
|---|---|
| Instagram | 7 h–8 h (réveil) · 12 h–13 h · 19 h–21 h (le meilleur) |
| Pinterest | 20 h–23 h en semaine ; le week-end fonctionne très bien |

Le « ciel du jour » a du sens **tôt le matin** (7 h–8 h) côté IG : on consulte son
ciel en se levant. Garde une heure cohérente jour après jour.

---

## Étape 4 — Vérification (1ʳᵉ semaine)

- [ ] Le lendemain, vérifier que les posts sont bien partis (pas en « échec » dans Metricool).
- [ ] Échec IG le plus fréquent = compte repassé en perso ou token Facebook expiré →
      reconnecter dans Metricool.
- [ ] Mettre dans la **bio IG** un lien trackable `llmastro.com/ciel?utm_source=instagram`
      et un lien Pinterest distinct → pour savoir lequel ramène du trafic.

---

## KPIs à suivre (Metricool Analytics)

- **Saves / partages** > likes (les saves prédisent la portée).
- **Pinterest : impressions + clics sortants** (c'est du trafic, pas de la vanity).
- Après 2–3 semaines : décaler les heures vers tes créneaux les plus performants.

---

## Évolution → full API (plus tard, si ça performe)

Quand le rythme est rodé, on supprime le geste hebdo en faisant publier
`daily-post.mjs` directement (Instagram Graph API + Pinterest API) depuis le VPS.
Prérequis : app Meta validée + image exposée à une URL publique (réutiliser
`/api/public/sky` / l'admin `/admin/social`). C'est le même esprit que
l'industrialisation vidéo Niveau 3 (Remotion) — à décider une fois le format prouvé.
