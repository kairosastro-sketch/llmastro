# API Horoscopes — documentation partenaire

Service de syndication d'horoscopes pour la presse, fourni par **Llmastro**
(llmastro.com). Horoscopes des 12 signes en français, édition quotidienne et
hebdomadaire, rédigés à partir des positions planétaires réelles calculées au
degré près (Swiss Ephemeris) et relus par nos soins.

## Authentification

Chaque appel doit porter votre clé dans l'en-tête HTTP `x-api-key` :

```
x-api-key: pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

La clé vous est remise une seule fois — conservez-la en lieu sûr et ne
l'exposez jamais côté navigateur. En cas de fuite, contactez-nous : nous la
révoquons et en émettons une nouvelle immédiatement.

## Récupérer l'édition du jour

```bash
curl -H "x-api-key: VOTRE_CLE" \
  "https://llmastro.com/api/partner/horoscopes/latest?cadence=day"
```

- `cadence=day` (défaut) — horoscope du jour
- `cadence=week` — horoscope de la semaine (édition du lundi)

## Récupérer une date précise

```bash
curl -H "x-api-key: VOTRE_CLE" \
  "https://llmastro.com/api/partner/horoscopes/2026-06-12?cadence=day"
```

La date (format `YYYY-MM-DD`) désigne le jour de parution : avec
`cadence=week`, n'importe quel jour de la semaine renvoie l'édition
hebdomadaire couvrant ce jour.

## Format de réponse

```json
{
  "success": true,
  "data": {
    "cadence": "day",
    "periodStart": "2026-06-12T00:00:00.000Z",
    "periodEnd": "2026-06-13T00:00:00.000Z",
    "language": "fr",
    "signs": [
      {
        "signIdx": 0,
        "sign": "Bélier",
        "text": "Texte de l'horoscope (380 à 480 caractères environ)…",
        "updatedAt": "2026-06-12T05:14:03.000Z"
      }
    ]
  }
}
```

- `signs` contient toujours **12 entrées**, dans l'ordre zodiacal
  (`signIdx` 0 = Bélier … 11 = Poissons).
- `text` : prose prête à imprimer, sans HTML ni markdown, vouvoiement,
  ~380-480 caractères espaces comprises.
- Les horodatages sont en UTC. La semaine commence le lundi.

## Erreurs

| Code HTTP | `error.code` | Signification |
|---|---|---|
| 401 | `UNAUTHORIZED` | Clé absente, invalide ou révoquée |
| 400 | `BAD_CADENCE` | `cadence` doit être `day` ou `week` |
| 400 | `BAD_DATE` | Date mal formée (attendu `YYYY-MM-DD`) |
| 404 | `EDITION_NOT_READY` | Édition pas encore générée pour cette période |

## Recommandations d'intégration

- **Tirez l'édition une fois par jour, après 07h00 (heure de Paris)** : elle
  est générée tôt le matin puis relue ; un texte peut être affiné en cours de
  matinée (`updatedAt` fait foi). Un second tirage vers midi récupère
  d'éventuelles retouches.
- Mettez la réponse en cache de votre côté : les textes d'une édition ne
  changent plus une fois la journée entamée.
- L'édition hebdomadaire est disponible dès le lundi matin et reste stable
  toute la semaine.
- Un seul appel suffit par édition (pas d'appel par signe).

## Contact

Support technique et facturation : a.drian.sauzade@gmail.com

<!-- GENERIC-HOROSCOPES-V1 partner doc applied -->
