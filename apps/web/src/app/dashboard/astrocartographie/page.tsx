// ============================================================
// ASTROCARTOGRAPHY-V1 — Page dédiée « Vos lieux » (/dashboard/astrocartographie)
// ------------------------------------------------------------
// Outil de LIEU (pas de temps) : sorti de l'horoscope quotidien.
//   - carte natale personnelle (lignes AC/MC/DC/IC)
//   - sélecteur de lieu : par défaut la ville de naissance, ou explorer
//     une autre ville → lecture ancrée sur CE lieu + hook transits du moment
//   - premium (entitlement astro.cartography)
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import { useApp } from "@/lib/i18n";
import { natalApi } from "@/lib/api/client";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Astrocartography } from "@/components/landing/Astrocartography";
import { PersonalReading } from "@/components/dashboard/PersonalAstrocartographySection";
import { CityAutocomplete, type CityValue } from "@/components/natal/CityAutocomplete";
import { UpgradeCTA } from "@/components/tiers/UpgradeCTA";

export default function AstrocartographiePage() {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const { allowed, known } = useEntitlement("astro.cartography");
  const [city, setCity] = useState<CityValue | null>(null);

  const { data: profilesRes } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });
  const profiles = (profilesRes as { data?: { profiles?: any[] } } | undefined)?.data?.profiles ?? [];
  const profile = profiles[0];
  const natalId: string | null = profile?.id ?? null;
  const birthCity: string | undefined = profile?.birthCity;

  const place = city
    ? { name: city.name, lat: city.latitude, lng: city.longitude }
    : null;

  return (
    <div style={{ paddingBottom: 24 }}>
      <header style={{ textAlign: "center", margin: "0.5rem auto 1.2rem", maxWidth: 640 }}>
        <span style={{
          display: "inline-block", fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "var(--gold)", marginBottom: 8,
        }}>
          ✦ Astrocartographie
        </span>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 500,
          fontSize: "clamp(1.6rem, 4vw, 2.2rem)", margin: 0, color: "var(--star)",
        }}>
          Vos lieux
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          Cette carte est figée à l’<b style={{ color: "var(--star)" }}>instant de ta naissance</b> et
          ne bouge jamais : ton ciel natal projeté sur la Terre. Le <b style={{ color: "var(--star)" }}>lieu</b> est
          permanent — Lisbonne restera un lieu de Vénus pour toi, que tu t’y intéresses le mois prochain
          ou dans dix ans. Ce n’est pas un horoscope du jour : on la consulte quand une question
          d’ailleurs se pose — voyage, installation, envie de changement.
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8, lineHeight: 1.55, opacity: 0.92 }}>
          La <b style={{ color: "var(--gold)" }}>lecture</b> y ajoute une fenêtre du moment : les transits
          actuels réveillent certaines de tes lignes (« en ce moment, tes lieux de Vénus sont porteurs »).
          Le lieu ne change pas ; le bon <i>moment</i> pour t’y tourner, oui — ça évolue de semaine en semaine.
        </p>
      </header>

      {/* Gate premium */}
      {known && !allowed && (
        <div className="card" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: 20 }}>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
            La carte de tes lieux et leur lecture sont réservées aux plans payants.
          </p>
          <UpgradeCTA feature="astro.cartography" label="Débloquer ma carte personnelle" />
        </div>
      )}

      {/* Pas de thème natal */}
      {known && allowed && !natalId && (
        <div className="card" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: 20 }}>
          <p style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
            Crée d’abord ton thème natal pour révéler tes lieux.
          </p>
          <Link href="/dashboard/natal" style={{ color: "var(--gold)", textDecoration: "underline" }}>
            Créer mon thème →
          </Link>
        </div>
      )}

      {/* Outil */}
      {known && allowed && natalId && (
        <>
          {/* Sélecteur de lieu */}
          <div style={{ maxWidth: 520, margin: "0 auto 0.4rem" }}>
            <CityAutocomplete
              value={city}
              onChange={setCity}
              locale={locale === "en" ? "en" : "fr"}
              label={locale === "en" ? "Explore a place" : "Explorer un lieu"}
              placeholder={locale === "en" ? "Type a city…" : "Tape une ville (Lisbonne, Tokyo…)"}
            />
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
              {city ? (
                <>
                  Lecture pour <b style={{ color: "var(--star)" }}>{city.name}</b> ·{" "}
                  <button
                    type="button"
                    onClick={() => setCity(null)}
                    style={{ background: "none", border: 0, color: "var(--gold)", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
                  >
                    revenir à {birthCity ?? "ma naissance"}
                  </button>
                </>
              ) : (
                <>Ancré sur ta ville de naissance{birthCity ? ` (${birthCity})` : ""} — ou explore un autre lieu ci-dessus.</>
              )}
            </p>
          </div>

          <Astrocartography source={{ kind: "personal", natalId, token: accessToken ?? undefined }} />
          <PersonalReading natalId={natalId} token={accessToken ?? undefined} place={place} />
        </>
      )}
    </div>
  );
}
