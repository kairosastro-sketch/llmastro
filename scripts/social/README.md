# Social — post quotidien « Le ciel du jour »

Génère chaque jour une image prête à poster (1080×1350, format portrait Instagram/TikTok)
et sa caption FR, à partir de l'API publique de prod (`/api/public/sky/{cadence}`, sans auth).

> **ADMIN-SOCIAL-POST-V1** : le même générateur existe en version navigateur dans
> l'admin (`/admin/social`, builder partagé porté dans
> `apps/web/src/lib/social-post.ts` — rendu PNG via `<canvas>`, sans resvg).
> Ce script CLI reste la voie de l'automatisation (tâche planifiée Windows) ;
> toute évolution du visuel doit être répercutée des deux côtés.

La roue reprend la géométrie de `apps/web/src/components/ui/ZodiacWheel.tsx`
(Bélier 0° à 9 h, sens antihoraire, écartement des planètes proches) en variante
sombre « Céleste » (tokens de `apps/web/src/app/globals.css`).

## Usage

```bash
cd scripts/social
npm install          # première fois uniquement (@resvg/resvg-js)
node daily-post.mjs  # → out/YYYY-MM-DD/ciel-day-YYYY-MM-DD.png + caption-day.txt
```

Options :

```bash
node daily-post.mjs --cadence week     # ou month (posts hebdo/mensuels)
node daily-post.mjs --api-url https://llmastro.com/api
node daily-post.mjs --out D:\posts
```

Sorties dans `out/YYYY-MM-DD/` :

- `ciel-<cadence>-<date>.png` — l'image finale (fond Céleste, roue, phase de lune, aspect du jour, URL)
- `ciel-<cadence>-<date>.svg` — le SVG source (retouches manuelles possibles)
- `caption-<cadence>.txt` — caption complète : phase de lune, positions rapides, 3 aspects du jour, lecture IA (`llmText` de l'API, tronquée à la phrase), CTA + hashtags
- `sky-<cadence>.json` — la réponse API brute (debug)

## Choix éditoriaux encodés

- **Aspects mis en avant** : aspects serrés impliquant au moins une planète rapide
  (Soleil, Lune, Mercure, Vénus, Mars) en priorité — les configurations lentes
  (Neptune ⚹ Pluton…) durent des mois et donneraient le même post chaque jour.
  L'opposition Nœud Nord/Sud (permanente) est exclue.
- **Roue** : 10 planètes + Nœud Nord. Lilith/Part de Fortune/Nœud Sud ne sont pas
  dessinés (lisibilité) mais peuvent apparaître nommés dans les aspects.
- **Pas de maisons ni d'ASC/MC** : ils dépendent du lieu de référence (Paris) — hors
  sujet pour un post générique.
- **Icône de lune dessinée en SVG** (resvg ne rend pas les emojis) ; l'emoji reste
  dans la caption texte.

## Automatisation (Windows, tâche planifiée)

```powershell
schtasks /Create /TN "Llmastro-DailyPost" /SC DAILY /ST 07:30 `
  /TR "node C:\Users\AZD\llmastro\scripts\social\daily-post.mjs"
```

La lecture IA est générée côté serveur tôt le matin ; si `llmText` est absent
(`⚠` affiché), relancer un peu plus tard — la caption reste valide sans elle.

## Dépendances

Dossier **hors workspace pnpm** (`pnpm-workspace.yaml` ne couvre que `apps/*` et
`packages/*`) : installé via `npm install` local, aucun impact sur le build/CI.
Rendu PNG : `@resvg/resvg-js` + polices système Windows (Segoe UI / Segoe UI Symbol
pour les glyphes ☉☽♀… ; sur Linux, prévoir une police couvrant ces codepoints,
ex. DejaVu Sans, et adapter `fontFiles`).
