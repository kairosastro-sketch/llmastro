// ============================================================
// PATCH À APPLIQUER À LA MAIN sur :
//   apps/web/src/components/natal/NatalForm.tsx
// ------------------------------------------------------------
// Objectif : remplacer le <input list="city-suggestions"> qui
// s'appuie sur les 37 villes hardcodées par le composant
// <CityAutocomplete> qui interroge la DB de 185 000 villes.
//
// 4 zones modifiées, identifiées ci-dessous par des marqueurs.
// ============================================================


// ──────────────────────────────────────────────────────────
// ZONE 1 — En haut du fichier, AJOUTER l'import (après les
// autres imports React/hooks). Et SUPPRIMER l'objet CITIES
// hardcodé (lignes 30-66) ainsi que CITY_NAMES (ligne 68-70).
// ──────────────────────────────────────────────────────────

// AJOUTER :
import { CityAutocomplete, type CityValue } from "./CityAutocomplete";

// SUPPRIMER (les anciennes lignes 30-70) :
//   const CITIES: Record<string, { lat: number; lng: number; ianaTz: string }> = { ... };
//   const CITY_NAMES = Object.keys(CITIES).sort(...);


// ──────────────────────────────────────────────────────────
// ZONE 2 — Dans le state du composant (ligne ~217).
//
// REMPLACER :
//   birthCity: initialProfile?.birthCity ?? "Paris",
// PAR :
//   selectedCity: initialProfile ? hydrateInitialCity(initialProfile) : null,
//   birthCityLabel: initialProfile?.birthCity ?? "",
//
// (On garde une string libre `birthCityLabel` pour rétro-compat
//  d'affichage si le profil existant référence une ville
//  qu'on ne retrouve pas en DB.)
// ──────────────────────────────────────────────────────────

// AJOUTER en haut du composant, à côté des autres helpers :
function hydrateInitialCity(p: InitialNatalProfile): CityValue | null {
  // Quand on édite un profil existant, on n'a que le nom de la
  // ville stocké en DB. On laisse l'utilisateur retaper pour la
  // resélectionner via l'autocomplete (et obtenir le geonameid).
  // Si on voulait la résoudre auto, il faudrait une route
  // GET /cities/search?q=<nom>&country=<cc> et prendre le 1er
  // résultat — à ajouter plus tard si nécessaire.
  return null;
}


// ──────────────────────────────────────────────────────────
// ZONE 3 — Dans la mutation (lignes 245-270 environ).
//
// REMPLACER tout le bloc :
//   const city = CITIES[form.birthCity];
//   if (!city) { ... throw ... }
//   const payload = { ...latitude: city.lat, ...timezone: city.ianaTz, ...birthCity: form.birthCity, birthCountry: "France", ... };
// PAR :
// ──────────────────────────────────────────────────────────

      if (!form.selectedCity) {
        throw new Error(
          locale === "fr"
            ? "Sélectionne une ville dans la liste de suggestions."
            : "Please select a city from the suggestions list.",
        );
      }

      const c = form.selectedCity;
      const payload = {
        label:              form.label,
        birthDate:          form.birthDate,
        birthTime:          form.timeUnknown ? "12:00" : form.birthTime,
        birthTimeUnknown:   form.timeUnknown,
        latitude:           c.latitude,
        longitude:          c.longitude,
        timezone:           c.ianaTz,
        birthCity:          c.name,
        birthCountry:       c.countryCode, // ISO-3166 (était hardcodé "France")
        gender:             form.gender,
        relationshipStatus: form.relationshipStatus,
      };


// ──────────────────────────────────────────────────────────
// ZONE 4 — Le JSX du champ ville (lignes 392-424).
//
// REMPLACER tout le <div style={{flex:1}}>...</div> contenant
// l'input + la datalist par :
// ──────────────────────────────────────────────────────────

          <div style={{ flex: 1 }}>
            <CityAutocomplete
              label={t("natal_city")}
              placeholder={locale === "fr" ? "Commence à taper…" : "Start typing…"}
              locale={locale === "en" ? "en" : "fr"}
              value={form.selectedCity}
              onChange={(city) => setForm(f => ({ ...f, selectedCity: city }))}
              required
            />
          </div>


// ──────────────────────────────────────────────────────────
// ZONE 5 — Suggestions résiduelles (lignes 449-470).
//
// SUPPRIMER tout le bloc {suggestions.length > 0 && ...} —
// l'autocomplete gère déjà ses propres suggestions, donc ce
// fallback n'a plus lieu d'être. On peut aussi enlever
// l'état `suggestions` et `setSuggestions` dans la fonction.
// ──────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────
// FIN DU PATCH
//
// Vérification après application :
//   1. cd apps/web && pnpm build       (doit passer)
//   2. pnpm dev                         (lancer en local)
//   3. Aller sur /dashboard/natal/new   (test du formulaire)
//   4. Taper "marse" → voir "Marseille FR" dans la liste
//   5. Sélectionner avec ↓↓ Enter → vérifier qu'on peut
//      bien créer le profil
// ──────────────────────────────────────────────────────────
