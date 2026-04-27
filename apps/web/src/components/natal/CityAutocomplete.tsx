// ============================================================
// apps/web/src/components/natal/CityAutocomplete.tsx
// ------------------------------------------------------------
// Champ d'autocomplete pour la ville de naissance, branché sur
// la table cities (~231 000 villes mondiales).
//
// v3 : affichage de la région (admin1) à côté du nom pour
// distinguer les homonymes ("Paris, Île-de-France" vs
// "Paris, Texas"). Drapeau seul à droite (plus de doublon FR FR).
// ============================================================

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CityValue {
  geonameid:   number;
  name:        string;
  countryCode: string;
  admin1Name:  string;
  latitude:    number;
  longitude:   number;
  ianaTz:      string;
}

interface CitySearchApiResult {
  geonameid:   number;
  name:        string;
  asciiName:   string;
  countryCode: string;
  admin1Code:  string;
  admin1Name:  string;
  population:  number;
  latitude:    number;
  longitude:   number;
  ianaTz:      string;
  score:       number;
}

interface CityAutocompleteProps {
  value: CityValue | null;
  onChange: (city: CityValue | null) => void;
  label?: string;
  placeholder?: string;
  locale?: "fr" | "en";
  restrictToCountry?: string;
  disabled?: boolean;
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
  const A = 127397;
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => c.charCodeAt(0) + A));
}

/**
 * Affichage principal : "Paris" ou "Paris, Île-de-France".
 * Si admin1Name est vide ou identique au nom de la ville, on n'ajoute rien.
 */
function cityLabel(c: CitySearchApiResult): string {
  if (!c.admin1Name) return c.name;
  // Évite les "Paris, Paris" (la ville et le département/région ont parfois le même nom)
  if (c.admin1Name.toLowerCase() === c.name.toLowerCase()) return c.name;
  return `${c.name}, ${c.admin1Name}`;
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
  // Le champ texte affiche le label complet (avec admin1) une fois sélectionné
  const initialQuery = value
    ? (value.admin1Name && value.admin1Name.toLowerCase() !== value.name.toLowerCase()
        ? `${value.name}, ${value.admin1Name}`
        : value.name)
    : "";
  const [query, setQuery]       = useState<string>(initialQuery);
  const [results, setResults]   = useState<CitySearchApiResult[]>([]);
  const [open, setOpen]         = useState<boolean>(false);
  const [loading, setLoading]   = useState<boolean>(false);
  const [error, setError]       = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const aborterRef   = useRef<AbortController | null>(null);
  const debouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync du label si value change de l'extérieur
  useEffect(() => {
    if (value) {
      const label = value.admin1Name && value.admin1Name.toLowerCase() !== value.name.toLowerCase()
        ? `${value.name}, ${value.admin1Name}`
        : value.name;
      setQuery(label);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debouncerRef.current) clearTimeout(debouncerRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    // Si la query correspond exactement au label de la value courante, pas la peine de chercher
    const valueLabel = value
      ? (value.admin1Name && value.admin1Name.toLowerCase() !== value.name.toLowerCase()
          ? `${value.name}, ${value.admin1Name}`
          : value.name)
      : null;
    if (valueLabel && query === valueLabel) {
      setResults([]);
      return;
    }
    debouncerRef.current = setTimeout(async () => {
      if (aborterRef.current) aborterRef.current.abort();
      const aborter = new AbortController();
      aborterRef.current = aborter;
      setLoading(true);
      setError(null);
      try {
        // Pour la recherche, on prend juste la 1re partie de query avant la virgule
        // (au cas où l'utilisateur a tapé "Paris, Île" dans le champ après resync)
        const searchQ = query.split(",")[0]!.trim() || query.trim();
        const r = await fetchCities(searchQ, restrictToCountry, aborter.signal);
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

  function handleSelect(c: CitySearchApiResult) {
    const v: CityValue = {
      geonameid:   c.geonameid,
      name:        c.name,
      countryCode: c.countryCode,
      admin1Name:  c.admin1Name,
      latitude:    c.latitude,
      longitude:   c.longitude,
      ianaTz:      c.ianaTz,
    };
    setQuery(cityLabel(c));
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

  const noResultsLabel = locale === "fr" ? "Aucune ville trouvée" : "No city found";
  const loadingLabel   = locale === "fr" ? "Recherche…" : "Searching…";

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
            // Si l'utilisateur édite, on dé-sélectionne
            if (value) {
              const valueLabel = value.admin1Name && value.admin1Name.toLowerCase() !== value.name.toLowerCase()
                ? `${value.name}, ${value.admin1Name}`
                : value.name;
              if (e.target.value !== valueLabel) onChange(null);
            }
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
                {cityLabel(c)}
              </span>
              <span aria-hidden style={{ fontSize: 16, flexShrink: 0 }}>
                {flagEmoji(c.countryCode)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
