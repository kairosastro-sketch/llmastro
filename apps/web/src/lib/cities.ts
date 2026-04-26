// ============================================================
// lib/cities.ts — Base de villes (extraction depuis NatalForm)
// ------------------------------------------------------------
// Doit refléter la base backend `packages/ephemeris/src/cities.ts`
// utilisée par `ephemerisService.calculateFromCityName`.
//
// Format : nom → { lat, lng, ianaTz }
// ============================================================

export interface CityCoords {
  lat:    number;
  lng:    number;
  ianaTz: string;
}

export const CITIES: Record<string, CityCoords> = {
  "Paris":              { lat: 48.857, lng: 2.352, ianaTz: "Europe/Paris" },
  "Lyon":               { lat: 45.764, lng: 4.836, ianaTz: "Europe/Paris" },
  "Marseille":          { lat: 43.297, lng: 5.37, ianaTz: "Europe/Paris" },
  "Toulouse":           { lat: 43.605, lng: 1.444, ianaTz: "Europe/Paris" },
  "Nice":               { lat: 43.71, lng: 7.262, ianaTz: "Europe/Paris" },
  "Bordeaux":           { lat: 44.838, lng: -0.579, ianaTz: "Europe/Paris" },
  "Lille":              { lat: 50.633, lng: 3.058, ianaTz: "Europe/Paris" },
  "Strasbourg":         { lat: 48.573, lng: 7.752, ianaTz: "Europe/Paris" },
  "Nantes":             { lat: 47.218, lng: -1.554, ianaTz: "Europe/Paris" },
  "Rennes":             { lat: 48.117, lng: -1.678, ianaTz: "Europe/Paris" },
  "Montpellier":        { lat: 43.611, lng: 3.877, ianaTz: "Europe/Paris" },
  "Grenoble":           { lat: 45.189, lng: 5.724, ianaTz: "Europe/Paris" },
  "Dijon":              { lat: 47.322, lng: 5.041, ianaTz: "Europe/Paris" },
  "Ajaccio":            { lat: 41.927, lng: 8.737, ianaTz: "Europe/Paris" },
  "Cayenne":            { lat: 4.933, lng: -52.327, ianaTz: "America/Cayenne" },
  "Fort-de-France":     { lat: 14.616, lng: -61.058, ianaTz: "America/Martinique" },
  "Pointe-à-Pitre":     { lat: 16.241, lng: -61.533, ianaTz: "America/Guadeloupe" },
  "Mamoudzou":          { lat: -12.78, lng: 45.228, ianaTz: "Indian/Mayotte" },
  "Saint-Denis (974)":  { lat: -20.882, lng: 55.451, ianaTz: "Indian/Reunion" },
  "Nouméa":             { lat: -22.275, lng: 166.458, ianaTz: "Pacific/Noumea" },
  "Papeete":            { lat: -17.551, lng: -149.558, ianaTz: "Pacific/Tahiti" },
  "Bruxelles":          { lat: 50.85, lng: 4.352, ianaTz: "Europe/Brussels" },
  "Genève":             { lat: 46.204, lng: 6.143, ianaTz: "Europe/Zurich" },
  "Luxembourg":         { lat: 49.612, lng: 6.13, ianaTz: "Europe/Luxembourg" },
  "Monaco":             { lat: 43.731, lng: 7.42, ianaTz: "Europe/Monaco" },
  "Londres":            { lat: 51.507, lng: -0.128, ianaTz: "Europe/London" },
  "Berlin":             { lat: 52.52, lng: 13.405, ianaTz: "Europe/Berlin" },
  "Madrid":             { lat: 40.417, lng: -3.704, ianaTz: "Europe/Madrid" },
  "Rome":               { lat: 41.902, lng: 12.496, ianaTz: "Europe/Rome" },
  "Montréal":           { lat: 45.502, lng: -73.567, ianaTz: "America/Toronto" },
  "New York":           { lat: 40.713, lng: -74.006, ianaTz: "America/New_York" },
  "Tokyo":              { lat: 35.6895, lng: 139.6917, ianaTz: "Asia/Tokyo" },
  "Sydney":             { lat: -33.8688, lng: 151.2093, ianaTz: "Australia/Sydney" },
  "Dakar":              { lat: 14.692, lng: -17.446, ianaTz: "Africa/Dakar" },
  "Casablanca":         { lat: 33.573, lng: -7.589, ianaTz: "Africa/Casablanca" },
};

export const CITY_NAMES: string[] = Object.keys(CITIES).sort((a, b) =>
  a.localeCompare(b, "fr", { sensitivity: "base" }),
);
