# Runbook — Vidéo « Niveau 1 » (faceless, sans caméra)

Process reproductible pour transformer le post quotidien « ciel du jour » en vidéo
verticale TikTok / Reels / Shorts, **sans se filmer**, en réutilisant ce que
`daily-post.mjs` produit déjà.

> Objectif : **régularité**, pas perfection. 3–4 vidéos/semaine, batchées en une
> session le dimanche. Une vidéo « bien » publiée bat une vidéo « parfaite » jamais finie.

---

## Chaîne d'outils (à installer une fois)

| Étape | Outil | Coût | Note |
|---|---|---|---|
| Asset visuel | `daily-post.mjs` (déjà là) | — | sort le PNG + la caption |
| Voix-off FR | **ElevenLabs** | gratuit pour tester, ~5 €/mois ensuite | choisir une voix FR posée (ex. « calme / mystique ») |
| Montage | **CapCut Desktop** | gratuit | timeline + musique + Ken Burns |
| Sous-titres animés | **Submagic** (ou auto-captions CapCut) | Submagic ~payant, CapCut gratuit | le style mot-à-mot retient l'attention |
| Musique | bibliothèque CapCut (libre de droits) | gratuit | ambiance « cosmic / lo-fi », volume bas |

Commence avec **CapCut auto-captions** (gratuit) ; passe à Submagic seulement si le format prend.

---

## Étape 0 — Générer l'asset du jour (déjà automatisé)

```bash
cd C:\Users\AZD\llmastro\scripts\social
node daily-post.mjs            # ciel du jour
# ou : node daily-post.mjs --cadence week   (post hebdo)
```

Sortie dans `out/YYYY-MM-DD/` :
- `ciel-day-YYYY-MM-DD.png` → le visuel (1080×1350, format 4:5)
- `caption-day.txt` → la caption (sert de base au script vocal ET à la description du post)

> Si `⚠` apparaît (lecture IA `llmText` absente), relancer un peu plus tard — la
> caption reste valide sans elle.

---

## Étape 1 — Écrire le script vocal (≈ 3 min)

⚠️ **Ne lis JAMAIS la caption telle quelle dans ElevenLabs.** Elle contient des
glyphes (`☉ ☽ □ ☌ ☍`), des hashtags et une URL → illisibles en voix-off.

Réécris-la en français parlé. Modèle (≈ 20–30 s, soit ~60–80 mots) :

```
Accroche (1 phrase, < 3 s)  →  ex. « Aujourd'hui le ciel te demande de ralentir. »
Le fait du jour              →  ex. « La lune en dernier croissant t'invite au repos
                                 et à laisser partir ce qui n'alimente plus. »
L'aspect clé reformulé       →  ex. « Mercure carré Saturne : tes échanges peuvent
                                 sembler bloqués, ne force pas. »
Conseil concret              →  ex. « Garde tes décisions importantes pour demain. »
CTA parlé                    →  ex. « Ta lecture complète au degré près est sur llmastro. »
```

Règles : phrases courtes, « tu », pas de symboles, pas de hashtags, l'URL se dit
(« sur llmastro point com »). **L'accroche dans les 3 premières secondes décide de tout.**

---

## Étape 2 — Générer la voix (ElevenLabs, ≈ 2 min)

1. Coller le script vocal, voix FR choisie, `Stability` ~50 %, `Similarity` ~75 %.
2. Générer, écouter, régénérer si débit trop rapide.
3. Télécharger le `.mp3`.

> Garde **la même voix** d'une vidéo à l'autre : c'est l'identité sonore de la marque.

---

## Étape 3 — Montage CapCut (≈ 6 min)

**Format : projet 9:16 (1080×1920).** Le PNG est en 4:5 → il faut combler haut/bas.

1. **Nouveau projet 9:16.**
2. **Fond** : dupliquer le PNG en plein écran, flou + assombri → remplit le 9:16
   sans bandes noires (reste dans la charte « Céleste »).
3. **Premier plan** : le PNG net centré (la roue), avec un léger **zoom lent
   (Ken Burns)** sur la durée → ça « bouge » sans vidéo.
4. **Zone du haut** (libérée par le 9:16) : texte d'accroche (= la 1ʳᵉ phrase du script).
5. **Zone du bas** : CTA `llmastro.com/ciel` discret + handle.
6. **Audio** : déposer le `.mp3` ElevenLabs (volume 100 %) + une musique d'ambiance
   CapCut (volume 10–15 %, fade in/out).
7. **Durée** : caler la fin de l'image sur la fin de la voix (20–35 s idéal).

---

## Étape 4 — Sous-titres (≈ 2 min)

- **CapCut** : `Texte → Captions automatiques → Français`. Vérifier l'orthographe
  des termes astro (signes, planètes — souvent mal transcrits). Style : police nette,
  contour, **un mot/segment surligné à la fois**.
- (Option) **Submagic** si tu veux des sous-titres plus dynamiques en 1 clic.

---

## Étape 5 — Export & publication (≈ 4 min)

1. Export CapCut : 1080×1920, 30 fps, sans watermark (désactiver dans les réglages export).
2. **Description** : reprendre la `caption-day.txt` (elle a déjà les hashtags + CTA).
   - TikTok : 3–5 hashtags max, mêler large (`#astrologie`) et niche (`#cieldujour`).
   - Reels : idem, ajouter un appel à l'action en commentaire.
   - Shorts : recoller la même vidéo, ça ne coûte rien.
3. **Publier sur les 3** : TikTok → Instagram Reels → YouTube Shorts (même fichier).
4. Mettre un **lien trackable** en bio (utm_source par réseau) pour mesurer ce qui ramène du trafic.

---

## Cadence recommandée — batch du dimanche (≈ 1 h pour 4 vidéos)

| Bloc | Action |
|---|---|
| 1 | Générer les assets de la semaine (`daily-post.mjs` plusieurs jours / `--cadence week`) |
| 2 | Écrire les 4 scripts vocaux d'un coup |
| 3 | Générer les 4 voix ElevenLabs d'un coup |
| 4 | Monter les 4 vidéos (le projet CapCut sert de gabarit : on remplace image + voix + texte) |
| 5 | Programmer les publications (planificateur natif TikTok/Meta) |

**Crée UN projet CapCut « gabarit »** (fond flou + zone titre + zone CTA + style
sous-titres) que tu dupliques à chaque vidéo : 80 % du montage est déjà fait.

---

## Banque d'angles (pour ne jamais être à court)

- « Le ciel du [jour] en 20 secondes » (le format quotidien par défaut)
- « Ce que prépare cette [pleine/nouvelle] lune »
- « Ton signe face à [transit du moment] » (carrousel de 12 → 1 vidéo/signe)
- « Pourquoi tu n'es pas QUE ton signe solaire » (pédagogie → pousse le thème complet)
- « 3 erreurs qu'on fait pendant Mercure rétrograde »
- Démo produit : la roue qui s'anime, l'horoscope personnalisé, l'astrocarto

Ratio : **70 % valeur/pédagogie · 20 % produit · 10 % vente directe.**

---

## Mesure

- KPI prioritaire : **taux de rétention à 3 s** + **saves/partages** (pas les likes).
- Lien bio trackable par réseau (`utm_source=tiktok` / `=reels` / `=shorts`).
- Au bout de 2–3 semaines : doubler la mise sur le format/angle qui retient le plus.

---

## Si le format prend → industrialisation (Niveau 3)

Le goulot ici, c'est le montage manuel. Quand le format est validé, le remplacer par
une variante **Remotion** de `daily-post.mjs` qui rend directement un `.mp4` 9:16
animé (roue qui tourne, aspects qui s'allument) + voix-off ElevenLabs via API →
une vidéo/jour en zéro effort récurrent. À décider plus tard, pas maintenant.
