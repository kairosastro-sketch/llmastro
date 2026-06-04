# Checklist Google Search Console — llmastro V1

> Checklist opérationnelle (côté Google, pas du code) à dérouler après le lot
> SEO de juin 2026. Contexte : audit des pages publiques + corrections livrées
> et déployées sur llmastro.com.
>
> **Lot SEO livré** (commits sur `main`) :
> - OG/Twitter image, canonicals (13 pages), `noindex` sur `/auth/*`
> - SSR du contenu `/pricing` (le `<h1>` était invisible aux crawlers)
> - JSON-LD : `Organization` (sitewide), `FAQPage` (`/pricing`), `Article`
>   (`/methode`, `/histoire`, `/le-ciel-et-l-ia`)
> - hreflang `x-default` sur `/ciel`, `lastmod` honnête + pages éditoriales
>   ajoutées au sitemap
>
> Cocher au fil de l'eau. Délais réalistes en bas.

## 0. Prérequis (une fois)
- [ ] Se connecter à https://search.google.com/search-console avec le compte Google de l'entreprise.
- [ ] **Vérifier la propriété en mode « Domaine »** (`llmastro.com`) plutôt que « Préfixe d'URL » → couvre `https`, `www`, apex et tous les sous-chemins.
  - Méthode : enregistrement **TXT DNS** chez **Gandi**.
  - Optionnel : garder aussi une propriété « Préfixe d'URL » (`https://llmastro.com`), certains rapports y sont plus lisibles.

## 1. Sitemap
- [ ] **Sitemaps → Ajouter un sitemap** : `sitemap.xml`
- [ ] Statut **« Réussite »**, URL découvertes = **15** (1 home + 8 ciel FR/EN + methode/limites/biblio/histoire/le-ciel-et-l-ia/pricing).
- [ ] **Paramètres → robots.txt** → statut « Récupéré ».

## 2. Inspection + indexation prioritaire
Pour chacune : **Inspection d'URL** → vérifier « URL sur Google » → **Demander une indexation**.
- [ ] `https://llmastro.com/` — home (canonical `llmastro.com`).
- [ ] `https://llmastro.com/pricing` — **le plus important** (page rendue crawlable). Ouvrir « Tester l'URL en direct » → **HTML rendu** et confirmer la présence du `<h1>Choisis ton plan</h1>` + FAQ.
- [ ] `https://llmastro.com/methode`
- [ ] `https://llmastro.com/histoire`
- [ ] `https://llmastro.com/le-ciel-et-l-ia`
- [ ] `https://llmastro.com/ciel/aujourd-hui`

> Sur l'inspection live, vérifier que le **canonical retenu par Google** = l'URL elle-même (pas la home).

## 3. Données structurées (rich results)
Tester dans le **Rich Results Test** (https://search.google.com/test/rich-results) :
- [ ] `/pricing` → **FAQPage** (6 questions), 0 erreur.
- [ ] `/` → **Organization** (logo + nom).
- [ ] `/methode` → **Article** (headline, image, dates, author/publisher).
- [ ] Plus tard dans GSC : **Améliorations → FAQ / Articles** apparaîtront après recrawl (1–2 semaines).

## 4. International (hreflang)
- [ ] (si l'EN doit être indexé) Vérifier sur une page `/ciel/*` que les alternates `fr` / `en` / `x-default` sont lus.

## 5. Hygiène (1ʳᵉ semaine puis mensuel)
- [ ] **Pages → Pourquoi les pages ne sont pas indexées** : confirmer que `/auth/*`, `/dashboard/*`, `/admin/*`, `/api/*` sont en « Bloquée par robots.txt » ou « Exclue par noindex » (attendu).
- [ ] Aucune page **publique voulue** en « Détectée, non indexée » ou « Dupliquée sans canonical ».
- [ ] **Core Web Vitals** + **Ergonomie mobile** : pas d'URL en rouge.
- [ ] **Liens** : maillage interne vers `/histoire` et `/le-ciel-et-l-ia`.

## 6. Suivi performance (récurrent)
- [ ] **Performances** → filtrer page `/pricing` : surveiller l'apparition d'impressions (preuve d'indexation avec contenu).
- [ ] Surveiller « thème natal », « horoscope français », « éphéméride du jour » → positions de départ.

## Délais réalistes
- Recrawl après « Demander indexation » : quelques heures à 3 jours.
- Rich results (FAQ/Article) dans la SERP : 1–3 semaines.
- `lastmod` du sitemap désormais honnête → confiance au signal restaurée progressivement.

## À refaire quand Stripe sera live
- [ ] Ajouter `Product`/`Offer` sur `/pricing` (seul item SEO délibérément différé : plans payants « bientôt disponible »/non achetables aujourd'hui), puis re-tester (Rich Results) + soumettre à l'indexation.
