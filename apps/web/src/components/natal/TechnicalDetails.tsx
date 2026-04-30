// ============================================================
// ARCHIVE-TECH-DETAILS-CSS-FIX-V1 — TechnicalDetails component
// ------------------------------------------------------------
// Réécriture du composant pour utiliser uniquement le design
// system du projet (globals.css + CSS variables) au lieu des
// classes Tailwind qui ne sont pas compilées dans cette build.
//
// Cohérent avec le style de KairosTrace.tsx qui utilise déjà
// cette approche et fonctionne correctement.
// ============================================================

"use client";

import { useState } from "react";

// ──────────────────────────────────────────────────────────
// Mappings d'affichage
// ──────────────────────────────────────────────────────────

const HOUSE_SYSTEM_LABELS: Record<string, string> = {
  placidus: "Placidus",
  koch: "Koch",
  whole_sign: "Signes entiers (Whole Sign)",
  P: "Placidus",
  K: "Koch",
  W: "Signes entiers (Whole Sign)",
};

const ZODIAC_LABELS: Record<string, string> = {
  tropical: "Tropical",
  sidereal: "Sidéral",
};

const RESOLUTION_LABELS: Record<string, string> = {
  valid: "Valide",
  ambiguous: "Ambiguë (changement d'heure)",
  nonexistent: "Inexistante (saut horaire)",
};

const RESOLUTION_TONES: Record<string, string> = {
  valid: "var(--harmony)",
  ambiguous: "var(--gold)",
  nonexistent: "var(--tension)",
};

// ──────────────────────────────────────────────────────────
// Helpers de formatage
// ──────────────────────────────────────────────────────────

function formatOffset(minutes: number | undefined): string {
  if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return "—";
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} (${minutes >= 0 ? "+" : ""}${minutes} min)`;
}

function formatJD(jd: number | undefined): string {
  if (jd === undefined || jd === null || Number.isNaN(jd)) return "—";
  return jd.toFixed(6);
}

// ──────────────────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────────────────

interface TechnicalDetailsProps {
  chart: any;
}

export function TechnicalDetails({ chart }: TechnicalDetailsProps) {
  const [verbose, setVerbose] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const meta = chart?.meta;
  const hasMeta = !!meta;

  const houseSystemLabel = HOUSE_SYSTEM_LABELS[chart?.houseSystem] ?? chart?.houseSystem ?? "—";
  const zodiacLabel = ZODIAC_LABELS[chart?.zodiac] ?? chart?.zodiac ?? "—";
  const resolutionLabel = RESOLUTION_LABELS[meta?.resolution] ?? meta?.resolution ?? "—";
  const resolutionTone = RESOLUTION_TONES[meta?.resolution] ?? "var(--muted)";
  const birthTimeKnown = meta?.birthTimeKnown ?? true;

  const jsonPayload = {
    source: "Swiss Ephemeris · JPL DE431 (NASA)",
    houseSystem: chart?.houseSystem,
    zodiac: chart?.zodiac,
    JD: chart?.JD,
    meta: meta ?? null,
  };

  function handleCopyJSON() {
    try {
      const text = JSON.stringify(jsonPayload, null, 2);
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    } catch {
      // silent — clipboard refusé (HTTP, browser policy, etc.)
    }
  }

  // ──────────────────────────────────────────────────────
  // Pas de meta → message dégradé
  // ──────────────────────────────────────────────────────
  if (!hasMeta) {
    return (
      <div className="card">
        <div
          className="section-title"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span>⚙</span>
          <span>Détails techniques</span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          Métadonnées non disponibles pour ce thème. Recalculez-le pour exposer les détails techniques (timezone, Julian Day, résolution DST, etc.).
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────
  // Rendu principal
  // ──────────────────────────────────────────────────────
  return (
    <div className="card-gold card" style={{ marginTop: 18 }}>
      {/* Header avec toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          className="section-title"
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}
        >
          <span>⚙</span>
          <span>Détails techniques</span>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--muted)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={verbose}
            onChange={(e) => setVerbose(e.target.checked)}
            style={{
              accentColor: "var(--gold)",
              width: "auto",
              padding: 0,
              margin: 0,
            }}
          />
          Explications détaillées
        </label>
      </div>

      {/* Avertissement heure inconnue */}
      {!birthTimeKnown && (
        <div
          style={{
            background: "rgba(212, 160, 23, 0.08)",
            border: "1px solid rgba(212, 160, 23, 0.28)",
            borderRadius: "var(--r-md)",
            padding: "9px 12px",
            marginBottom: 14,
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--neutral)",
          }}
        >
          <strong>Heure de naissance inconnue.</strong>{" "}
          <span style={{ color: "var(--muted)" }}>
            L'ascendant, le milieu du ciel et le découpage des maisons sont calculés à 12:00 par défaut. Ces éléments doivent être considérés comme indicatifs.
          </span>
        </div>
      )}

      {/* Tableau dense */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-display)",
          }}
        >
          <tbody>
            <Row
              label="Source des éphémérides"
              value="Swiss Ephemeris · JPL DE431 (NASA)"
              hint={verbose ? "Tables astronomiques compilées par le Jet Propulsion Laboratory (NASA). Précision sub-seconde sur les positions planétaires entre −13 200 et +17 191." : null}
            />
            <Row
              label="Système de maisons"
              value={houseSystemLabel}
              hint={verbose ? "Méthode de division du ciel en 12 secteurs. Placidus est le plus utilisé en astrologie occidentale moderne ; Whole Sign est plus stable aux hautes latitudes." : null}
            />
            <Row
              label="Zodiaque"
              value={zodiacLabel}
              hint={verbose ? "Tropical : aligné sur les saisons (point vernal). Sidéral : aligné sur les constellations réelles. Llmastro utilise le tropical par défaut, convention occidentale." : null}
            />
            <Row
              label="Date de naissance (locale)"
              value={`${meta.localBirthDate ?? "—"} ${meta.localBirthTime ?? ""}`.trim()}
              hint={null}
            />
            <Row
              label="Timezone IANA"
              value={meta.ianaTz ?? "—"}
              hint={verbose ? "Identifiant standard (ex. Europe/Paris) qui gère automatiquement les changements d'heure d'été/hiver et leurs évolutions historiques. Bien plus fiable qu'un offset numérique figé." : null}
            />
            <Row
              label="Offset UTC appliqué"
              value={formatOffset(meta.offsetMinutes)}
              hint={null}
            />
            <Row
              label="Résolution timezone"
              value={resolutionLabel}
              valueStyle={{ color: resolutionTone }}
              hint={verbose ? (
                meta.resolution === "ambiguous"
                  ? "L'heure tombe pendant un changement d'heure d'été→hiver : 02:30 existe deux fois ce jour-là. Llmastro retient la première occurrence (avant le recul de l'horloge)."
                  : meta.resolution === "nonexistent"
                  ? "L'heure tombe pendant un saut horaire (printemps) : 02:30 n'existe pas. Llmastro décale automatiquement à l'heure légale suivante."
                  : "L'heure locale est non-ambiguë et bien définie pour cette date et ce fuseau."
              ) : null}
            />
            <Row
              label="Instant UTC absolu"
              value={meta.utcISO ?? "—"}
              valueMono
              hint={verbose ? "Référence universelle indépendante du fuseau horaire. Si tu veux vérifier le calcul sur un autre logiciel d'éphémérides, c'est cette valeur qu'il faut entrer." : null}
            />
            <Row
              label="Julian Day"
              value={formatJD(chart?.JD)}
              valueMono
              hint={verbose ? "Numéro de jour continu depuis le 1ᵉʳ janvier 4713 av. J.-C. (calendrier julien). Permet aux algorithmes astronomiques de calculer sans gérer les complexités du calendrier grégorien." : null}
            />
            <Row
              label="Heure connue"
              value={birthTimeKnown ? "Oui" : "Non — heure par défaut 12:00"}
              valueStyle={{
                color: birthTimeKnown ? "var(--harmony)" : "var(--neutral)",
              }}
              hint={null}
            />
            <Row
              label="Delta T"
              value="Appliqué automatiquement"
              hint={verbose ? "Écart entre le temps universel UT (basé sur la rotation de la Terre, qui ralentit) et le temps terrestre TT (référence uniforme). Swiss Ephemeris l'applique en interne, valeur de l'ordre de 70 secondes en 2026." : null}
            />
          </tbody>
        </table>
      </div>

      {/* Bouton copier JSON */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button
          onClick={handleCopyJSON}
          className="btn-ghost"
          style={{
            fontSize: 11,
            padding: "6px 14px",
            background: copied ? "rgba(62,207,142,0.12)" : "rgba(201,168,76,0.08)",
            borderColor: copied ? "var(--harmony)" : "var(--border)",
            color: copied ? "var(--harmony)" : "var(--gold)",
          }}
        >
          {copied ? "✓ Copié" : "📋 Copier en JSON"}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-component : ligne de tableau avec hint optionnel
// ──────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  valueMono?: boolean;
  valueStyle?: React.CSSProperties;
  hint: string | null;
}

function Row({ label, value, valueMono, valueStyle, hint }: RowProps) {
  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <td
          style={{
            padding: "9px 8px 9px 0",
            verticalAlign: "top",
            color: "var(--muted)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".06em",
            width: "40%",
            fontFamily: "var(--font-body)",
          }}
        >
          {label}
        </td>
        <td
          style={{
            padding: "9px 0",
            verticalAlign: "top",
            color: "var(--star)",
            fontSize: 13,
            fontFamily: valueMono ? "var(--font-mono)" : "var(--font-display)",
            ...(valueStyle ?? {}),
          }}
        >
          {value}
        </td>
      </tr>
      {hint ? (
        <tr>
          <td colSpan={2} style={{ paddingBottom: 10, paddingTop: 0 }}>
            <p
              style={{
                fontSize: 11.5,
                color: "var(--muted)",
                fontStyle: "italic",
                lineHeight: 1.55,
                fontFamily: "var(--font-display)",
              }}
            >
              {hint}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ARCHIVE-TECH-DETAILS-CSS-FIX-V1 applied

// ARCHIVE-NATAL-FIELDS-MAPPING-V1 applied
