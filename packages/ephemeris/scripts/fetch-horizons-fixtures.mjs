// ============================================================
// fetch-horizons-fixtures.mjs — HORIZONS-BENCHMARK-V1
// ------------------------------------------------------------
// Génère les fixtures JPL Horizons utilisées par
// tests/horizons-benchmark.test.ts. À lancer MANUELLEMENT (les
// tests ne font AUCUN appel réseau — les valeurs sont figées
// dans le fichier de test avec leur provenance).
//
//   node scripts/fetch-horizons-fixtures.mjs
//
// Quantité Horizons 31 (ObsEcLon/ObsEcLat) :
//   « Observer-centered IAU76/80 ecliptic-of-date longitude and
//   latitude of the target centers' apparent position, with
//   light-time, gravitational deflection of light, and stellar
//   aberrations. »
// → mêmes conventions que swe_calc_ut par défaut (position
//   apparente géocentrique, équinoxe/écliptique vraies de la
//   date). Centre 500@399 = géocentre. Heures en UT (UTC après
//   1962, UT1 avant) — même échelle que swe_calc_ut.
//
// Corps : barycentres ('4'…'9') pour Mars→Pluton, comme les
// éphémérides DE sous-jacentes à swisseph (l'écart angulaire
// centre↔barycentre est ≤ 0.1″ vu de la Terre).
// ============================================================

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";

// JD UT des dates de référence.
const DATES = [
  { label: "1900-01-01 00:00 UT", jd: 2415020.5 },
  { label: "1970-01-01 00:00 UT", jd: 2440587.5 },
  { label: "2000-01-01 12:00 UT (J2000)", jd: 2451545.0 },
  { label: "2025-01-01 00:00 UT", jd: 2460676.5 },
];

const BODIES = [
  { key: "sun",     command: "10"  },
  { key: "moon",    command: "301" },
  { key: "mercury", command: "199" },
  { key: "venus",   command: "299" },
  { key: "mars",    command: "4"   },
  { key: "jupiter", command: "5"   },
  { key: "saturn",  command: "6"   },
  { key: "uranus",  command: "7"   },
  { key: "neptune", command: "8"   },
  { key: "pluto",   command: "9"   },
];

const TLIST = DATES.map(d => d.jd).join(" ");

async function fetchBody(command) {
  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    TLIST: `'${TLIST}'`,
    TLIST_TYPE: "'JD'",
    QUANTITIES: "'31'",
    CSV_FORMAT: "'YES'",
    ANG_FORMAT: "'DEG'",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status} pour COMMAND=${command}`);
  const text = await res.text();
  const block = text.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) throw new Error(`Pas de bloc SOE/EOE pour COMMAND=${command} :\n${text.slice(0, 500)}`);
  // Lignes CSV : " 2000-Jan-01 12:00:00.000, , , 280.3689092,  0.0002381,"
  const rows = block.trim().split("\n").map(line => {
    const cols = line.split(",").map(s => s.trim());
    return { lon: Number(cols[3]), lat: Number(cols[4]) };
  });
  if (rows.length !== DATES.length || rows.some(r => !Number.isFinite(r.lon))) {
    throw new Error(`Parse inattendu pour COMMAND=${command} :\n${block}`);
  }
  return rows;
}

const out = {};
for (const body of BODIES) {
  const rows = await fetchBody(body.command);
  rows.forEach((r, i) => {
    (out[DATES[i].jd] ??= { label: DATES[i].label, bodies: {} }).bodies[body.key] = r;
  });
  console.error(`✓ ${body.key}`);
}
console.log(JSON.stringify(out, null, 2));
