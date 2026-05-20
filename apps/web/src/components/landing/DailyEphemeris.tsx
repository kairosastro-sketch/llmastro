// ARCHIVE-LANDING-EPHEMERIDES-V2
// Orchestrateur du module éphéméride sur la landing.
// Fetch /public/ephemeris/sky/now, refetch toutes les 10 min.
// Affiche : header date, roue avec positions, table planètes, phase lunaire.

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { useApp } from "@/lib/i18n";
import { getLocalizedMoonPhase } from "@/lib/i18n/moon-phase";
import styles from "./dailyEphemeris.module.css";
import { EphemerisWheel } from "./EphemerisWheel";
import { EphemerisTable } from "./EphemerisTable";

interface PlanetData {
  longitude: number;
  retrograde?: boolean;
}

interface MoonPhase {
  key?:         string;
  phase?:       string;
  emoji?:       string;
  description?: string;
  illumination?: number;
}

interface SkyPayload {
  date:      string;
  lat:       number;
  lng:       number;
  planets:   Record<string, PlanetData>;
  asc:       number;
  mc:        number;
  moonPhase: MoonPhase | null;
}

const REFETCH_MS = 10 * 60 * 1000;   // 10 min

interface DailyEphemerisProps {
  /** ARCHIVE-LANDING-HERO-IMMERSIVE-V1 : "card" = layout complet (default), "immersive" = roue seule géante */
  variant?: "card" | "immersive";
}

function formatDateLine(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  // Format heure UTC façon "06h26 T.U." comme sur le screenshot Adrian
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hh}h${mm} T.U.`;
}

export function DailyEphemeris({ variant = "card" }: DailyEphemerisProps = {}) {
  const { data: res, isLoading, isError } = useQuery({
    queryKey:        ["public-ephemeris-sky"],
    queryFn:         () => apiClient.get<SkyPayload>("/public/ephemeris/sky/now"),
    staleTime:       REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry:           1,
  });

  const sky = (res as { data?: SkyPayload } | undefined)?.data;

  // ARCHIVE-LANDING-HERO-IMMERSIVE-V1 : variant immersive = roue seule géante,
  // sans header/table/lune (gérés par le hero parent et le marquee)
  if (variant === "immersive") {
    return (
      <div
        className={styles.immersiveWheel}
        aria-label="Le ciel maintenant — roue zodiacale"
      >
        {isLoading && (
          <div className={styles.loading}>
            <div className="spinner" aria-hidden />
          </div>
        )}
        {sky && !isLoading && (
          <EphemerisWheel
            planets={sky.planets}
            ascendant={sky.asc}
            variant="immersive"
          />
        )}
        {/* MINOR-FIXES-V1 — lien vers /ciel pour la vue par cadence */}
        <p
          style={{
            marginTop: "1rem",
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          <Link
            href="/ciel/aujourd-hui"
            style={{ color: "var(--gold)", textDecoration: "underline" }}
          >
            Vue par jour, semaine, mois ou année &rarr;
          </Link>
        </p>
      </div>
    );
  }

  // Variant "card" (default) : layout complet
  return (
    <section
      className={styles.module}
      aria-label="Éphéméride du jour"
    >
      <header className={styles.header}>
        <span className={styles.eyebrow}>✦ Le ciel maintenant</span>
        <h2 className={styles.title}>Transits et éphémérides</h2>
        {sky?.date && (
          <p className={styles.dateLine}>{formatDateLine(sky.date)}</p>
        )}
        {/* CIEL-PUBLIC-V1-CLARITY-V1 — lien vers /ciel pour vue par cadence */}
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          <Link
            href="/ciel/aujourd-hui"
            style={{ color: "var(--gold)", textDecoration: "underline" }}
          >
            Vue par jour, semaine, mois ou année →
          </Link>
        </p>
      </header>

      {isLoading && (
        <div className={styles.loading}>
          <div className="spinner" aria-hidden />
          <span className={styles.loadingText}>Calcul des positions astrales…</span>
        </div>
      )}

      {isError && (
        <div className={styles.error}>
          Le ciel reste mystérieux pour l'instant. Reviens dans un instant.
        </div>
      )}

      {sky && !isLoading && (
        <>
          <EphemerisWheel planets={sky.planets} ascendant={sky.asc} />
          <EphemerisTable planets={sky.planets} />
          {sky.moonPhase && sky.moonPhase.phase && (
            <MoonPhaseDisplay moonPhase={sky.moonPhase} />
          )}
        </>
      )}
    </section>
  );
}

function MoonPhaseDisplay({ moonPhase }: { moonPhase: MoonPhase }) {
  const { locale } = useApp();
  const lang = locale === "en" ? "en" : "fr";
  const localized = getLocalizedMoonPhase(moonPhase.key, lang);
  const illum = moonPhase.illumination !== undefined
    ? `${(moonPhase.illumination * 100).toFixed(1)}%`
    : null;

  return (
    <div className={styles.moonPhase} role="group" aria-label={lang === "en" ? "Moon phase" : "Phase lunaire"}>
      <span className={styles.moonEmoji} aria-hidden>
        {moonPhase.emoji ?? "🌙"}
      </span>
      <div className={styles.moonText}>
        <span className={styles.moonName}>
          {localized?.phase ?? moonPhase.phase}
          {illum && <span style={{ color: "var(--muted)", fontStyle: "italic" }}> · {illum}</span>}
        </span>
        {(localized?.description ?? moonPhase.description) && (
          <span className={styles.moonDesc}>{localized?.description ?? moonPhase.description}</span>
        )}
      </div>
    </div>
  );
}

// ARCHIVE-LANDING-HERO-IMMERSIVE-V1 applied

// CIEL-PUBLIC-V1-CLARITY-V1 DailyEphemeris applied

// MINOR-FIXES-V1 DailyEphemeris applied
