// ============================================================
// apps/web/src/components/natal/CityAutocomplete.tsx
// ------------------------------------------------------------
// Champ d'autocomplete pour la ville de naissance, branché sur
// la nouvelle table `cities` (~185 000 villes mondiales).
//
// Remplace le <select> hardcodé qui n'avait que 37 villes dans
// NatalForm.tsx.
//
// Comportement :
//   • Tape ≥ 2 caractères → debounce 250 ms → fetch /cities/search
//   • Liste déroulante avec navigation clavier (↑↓ Enter Esc)
//   • Sélection : remonte au parent { name, lat, lng, ianaTz, geonameid }
//   • Affiche le pays en gris à droite (ex. "Marseille  · FR")
//   • Fallback "aucun résultat" si la base ne connaît pas la ville
//
// Note sur le réseau :
//   La route /cities/search est PUBLIQUE (pas d'auth requise),
//   donc utilisable depuis la page de création de profil natal
//   même avant inscription.
// ============================================================

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CityValue {
  geonameid:   number;
  name:        string;       // Affichage UTF-8 (ex. "Genève")
  countryCode: string;       // ISO-3166 alpha-2 (ex. "CH")
  latitude:    number;
  longitude:   number;
  ianaTz:      string;       // ex. "Europe/Zurich"
}

interface CitySearchApiResult {
  geonameid:   number;
  name:        string;
  asciiName:   string;
  countryCode: string;
  population:  number;
  latitude:    number;
  longitude:   number;
  ianaTz:      string;
  score:       number;
}

interface CityAutocompleteProps {
  /** Valeur courante (city sélectionnée, ou null si rien). */
  value: CityValue | null;
  /** Callback de sélection. */
  onChange: (city: CityValue | null) => void;
  /** Texte du label affiché au-dessus du champ. */
  label?: string;
  /** Texte du placeholder dans le champ. */
  placeholder?: string;
  /** Locale d'affichage des messages ("fr" | "en"). */
  locale?: "fr" | "en";
  /** Si défini, restreint la recherche à un pays (ex. "FR"). */
  restrictToCountry?: string;
  /** Désactive le champ. */
  disabled?: boolean;
  /** Affiche l'astérisque "champ requis". */
  required?: boolean;
}

// ─────────────────────────────────────────────────────────────
// API client
// ─────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchCities(
  query: string,
  countryCode?: string,
  signal?: AbortSignal,
): Promise<CitySearchApiResult[]> {
  const params = new URLSearchParams({ q: query, limit: "10" });
  if (countryCode) params.set("country", countryCode);
  const res = await fetch(`${API_BASE}/cities/search?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Search failed");
  return json.data.results as CitySearchApiResult[];
}

// ─────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────

function flagEmoji(cc: string): string {
  if (cc.length !== 2) return "";
  const A = 127397; // 'A'.charCodeAt(0) - 65 + 0x1F1A5
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => c.charCodeAt(0) + A));
}

function cityDisplay(c: CitySearchApiResult): string {
  return c.name;
}

// ─────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────

export function CityAutocomplete({
  value,
  onChange,
  label,
  placeholder,
  locale = "fr",
  restrictToCountry,
  disabled = false,
  required = false,
}: CityAutocompleteProps) {
  const [query, setQuery]       = useState<string>(value?.name ?? "");
  const [results, setResults]   = useState<CitySearchApiResult[]>([]);
  const [open, setOpen]         = useState<boolean>(false);
  const [loading, setLoading]   = useState<boolean>(false);
  const [error, setError]       = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const aborterRef   = useRef<AbortController | null>(null);
  const debouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronise la query avec value en cas de reset externe
  useEffect(() => {
    if (value) setQuery(value.name);
    else if (query === "") return;
    // Si value passe à null mais que l'utilisateur tape, on ne touche pas
  }, [value]);

  // Fermeture sur clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recherche debouncée
  useEffect(() => {
    if (debouncerRef.current) clearTimeout(debouncerRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    // Si la query correspond exactement à la valeur courante, pas la peine de chercher
    if (value && query === value.name) {
      setResults([]);
      return;
    }
    debouncerRef.current = setTimeout(async () => {
      // Annule la requête précédente s'il y en a une
      if (aborterRef.current) aborterRef.current.abort();
      const aborter = new AbortController();
      aborterRef.current = aborter;
      setLoading(true);
      setError(null);
      try {
        const r = await fetchCities(query.trim(), restrictToCountry, aborter.signal);
        setResults(r);
        setActiveIdx(r.length > 0 ? 0 : -1);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(locale === "fr" ? "Erreur de recherche" : "Search error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debouncerRef.current) clearTimeout(debouncerRef.current);
    };
  }, [query, restrictToCountry, locale, value]);

  // ─────────────────────────────────────────────────────────
  // Sélection
  // ─────────────────────────────────────────────────────────

  function handleSelect(c: CitySearchApiResult) {
    const v: CityValue = {
      geonameid:   c.geonameid,
      name:        c.name,
      countryCode: c.countryCode,
      latitude:    c.latitude,
      longitude:   c.longitude,
      ianaTz:      c.ianaTz,
    };
    setQuery(c.name);
    setResults([]);
    setOpen(false);
    onChange(v);
    inputRef.current?.blur();
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }

  // ─────────────────────────────────────────────────────────
  // Navigation clavier
  // ─────────────────────────────────────────────────────────

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        setActiveIdx(i => (i + 1) % results.length);
        e.preventDefault();
        break;
      case "ArrowUp":
        setActiveIdx(i => (i - 1 + results.length) % results.length);
        e.preventDefault();
        break;
      case "Enter":
        if (activeIdx >= 0 && results[activeIdx]) {
          handleSelect(results[activeIdx]!);
          e.preventDefault();
        }
        break;
      case "Escape":
        setOpen(false);
        e.preventDefault();
        break;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  const noResultsLabel = locale === "fr"
    ? "Aucune ville trouvée"
    : "No city found";
  const loadingLabel = locale === "fr" ? "Recherche…" : "Searching…";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            marginBottom: 4,
            color: "var(--text-muted, #9aa0b4)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}{required ? " *" : ""}
        </label>
      )}

      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Si l'utilisateur édite, on dé-sélectionne la value courante
            if (value && e.target.value !== value.name) onChange(null);
          }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? (locale === "fr" ? "Tapez votre ville…" : "Type your city…")}
          disabled={disabled}
          required={required}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="city-autocomplete-list"
          aria-activedescendant={activeIdx >= 0 ? `city-opt-${activeIdx}` : undefined}
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: 8,
            background: "var(--input-bg, rgba(255,255,255,0.04))",
            color: "var(--text, #e8eaf3)",
            fontSize: 14,
            outline: "none",
          }}
        />
        {/* Bouton clear si une valeur est sélectionnée */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={locale === "fr" ? "Effacer la ville" : "Clear city"}
            style={{
              position: "absolute",
              right: 8, top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: 0,
              color: "var(--text-muted, #9aa0b4)",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          id="city-autocomplete-list"
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0, right: 0,
            marginTop: 4,
            maxHeight: 280,
            overflowY: "auto",
            listStyle: "none",
            padding: 0,
            background: "var(--popover, #1b1f30)",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 50,
          }}
        >
          {loading && (
            <li style={{ padding: "10px 12px", color: "var(--text-muted, #9aa0b4)", fontSize: 13 }}>
              {loadingLabel}
            </li>
          )}
          {!loading && error && (
            <li style={{ padding: "10px 12px", color: "var(--error, #ff6b6b)", fontSize: 13 }}>
              {error}
            </li>
          )}
          {!loading && !error && results.length === 0 && (
            <li style={{ padding: "10px 12px", color: "var(--text-muted, #9aa0b4)", fontSize: 13 }}>
              {noResultsLabel}
            </li>
          )}
          {!loading && results.map((c, i) => (
            <li
              key={c.geonameid}
              id={`city-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                background: i === activeIdx
                  ? "var(--hover, rgba(255,255,255,0.06))"
                  : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 14,
              }}
            >
              <span style={{ color: "var(--text, #e8eaf3)" }}>
                {cityDisplay(c)}
              </span>
              <span style={{ color: "var(--text-muted, #9aa0b4)", fontSize: 12, flexShrink: 0 }}>
                <span aria-hidden style={{ marginRight: 4 }}>{flagEmoji(c.countryCode)}</span>
                {c.countryCode}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
