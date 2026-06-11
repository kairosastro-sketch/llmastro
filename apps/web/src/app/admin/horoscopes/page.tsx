// ============================================================
// GENERIC-HOROSCOPES-V1
// apps/web/src/app/admin/horoscopes/page.tsx
// ------------------------------------------------------------
// Relecture des horoscopes génériques presse (12 signes,
// quotidien + hebdo) : édition manuelle, régénération par signe
// ou globale (les textes retouchés sont préservés), et gestion
// des clés API partenaires (quotidiens locaux).
// ============================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  adminHoroscopesApi,
  type AdminHoroscopeSign,
  type PartnerKeyPayload,
} from "@/lib/api/client";

type Cadence = "day" | "week";

export default function AdminHoroscopesPage() {
  const { accessToken } = useAuth();

  const [cadence, setCadence] = useState<Cadence>("day");
  const [signs, setSigns] = useState<AdminHoroscopeSign[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id ou "all" en régénération
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [keys, setKeys] = useState<PartnerKeyPayload[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [freshToken, setFreshToken] = useState<{ name: string; token: string } | null>(null);

  const load = useCallback(async (cad: Cadence) => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try {
      const res = await adminHoroscopesApi.list(accessToken, cad);
      const data = (res as any).data;
      setSigns(data.signs);
      setPeriod({ start: data.periodStart, end: data.periodEnd });
      setDrafts({});
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadKeys = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await adminHoroscopesApi.listKeys(accessToken);
      setKeys((res as any).data.keys);
    } catch { /* non bloquant */ }
  }, [accessToken]);

  useEffect(() => { void load(cadence); }, [cadence, load]);
  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const saveText = async (s: AdminHoroscopeSign) => {
    if (!accessToken) return;
    const text = drafts[s.id];
    if (text === undefined || text === s.text) return;
    setBusy(s.id);
    try {
      await adminHoroscopesApi.updateText(accessToken, s.id, text);
      await load(cadence);
    } catch (e: any) {
      setError(e?.message ?? "Échec de la sauvegarde");
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async (signIdx?: number) => {
    if (!accessToken) return;
    setBusy(signIdx === undefined ? "all" : String(signIdx));
    setError(null);
    try {
      await adminHoroscopesApi.regenerate(accessToken, cadence, signIdx);
      await load(cadence);
    } catch (e: any) {
      setError(e?.message ?? "Échec de la régénération");
    } finally {
      setBusy(null);
    }
  };

  const createKey = async () => {
    if (!accessToken || newKeyName.trim().length < 2) return;
    try {
      const res = await adminHoroscopesApi.createKey(accessToken, newKeyName.trim());
      const data = (res as any).data;
      setFreshToken({ name: data.name, token: data.token });
      setNewKeyName("");
      await loadKeys();
    } catch (e: any) {
      setError(e?.message ?? "Échec de la création de clé");
    }
  };

  const revokeKey = async (id: string) => {
    if (!accessToken) return;
    try {
      await adminHoroscopesApi.revokeKey(accessToken, id);
      await loadKeys();
    } catch (e: any) {
      setError(e?.message ?? "Échec de la révocation");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Horoscopes presse</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Éditions génériques (12 signes) générées automatiquement chaque période et servies
        aux quotidiens partenaires via <code>/api/partner/horoscopes</code>. Les textes
        retouchés à la main (badge ✎) ne sont jamais écrasés par la régénération globale.
      </p>

      {/* Cadence + actions globales */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {(["day", "week"] as Cadence[]).map((c) => (
          <button
            key={c}
            className="btn-ghost"
            onClick={() => setCadence(c)}
            style={c === cadence ? { borderColor: "var(--gold, #8a5e10)", fontWeight: 600 } : undefined}
          >
            {c === "day" ? "Jour" : "Semaine"}
          </button>
        ))}
        {period && (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
            Édition du {fmtDate(period.start)}
          </span>
        )}
        <button
          className="btn-ghost"
          onClick={() => regenerate()}
          disabled={busy !== null}
          style={{ marginLeft: "auto" }}
        >
          {busy === "all" ? "Régénération…" : "↻ Tout régénérer"}
        </button>
      </div>

      {error && <p style={{ color: "#e54545", fontSize: 13 }}>{error}</p>}
      {loading && <div className="spinner" style={{ margin: "30px auto" }} />}

      {!loading && signs.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Édition pas encore générée (génération automatique horaire, ou « Tout régénérer »).
        </p>
      )}

      {/* 12 cartes signes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {signs.map((s) => {
          const draft = drafts[s.id] ?? s.text;
          const dirty = draft !== s.text;
          return (
            <div key={s.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{s.sign}</strong>
                {s.edited && <span title="Retouché à la main" style={{ fontSize: 12 }}>✎</span>}
                <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11.5 }}>
                  {draft.length} car.
                </span>
              </div>
              <textarea
                value={draft}
                rows={6}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                style={{
                  width: "100%", fontSize: 12.5, lineHeight: 1.5, padding: 10,
                  borderRadius: 8, border: "1px solid var(--muted)",
                  background: "transparent", color: "inherit", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={() => saveText(s)}
                  disabled={!dirty || busy !== null}
                  style={{ fontSize: 12.5 }}
                >
                  {busy === s.id ? "…" : "Enregistrer"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => regenerate(s.signIdx)}
                  disabled={busy !== null}
                  style={{ fontSize: 12.5 }}
                >
                  {busy === String(s.signIdx) ? "…" : "↻ Régénérer"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clés API partenaires */}
      <div className="sep" style={{ margin: "28px 0" }} />
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Clés API partenaires</h2>
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 12 }}>
        Une clé par client. Usage : <code>GET /api/partner/horoscopes/latest?cadence=day</code>{" "}
        avec l'en-tête <code>x-api-key</code>. Le token complet n'est affiché qu'à la création.
      </p>

      {freshToken && (
        <div className="card" style={{ padding: 14, marginBottom: 14, border: "1px solid var(--gold, #8a5e10)" }}>
          <strong style={{ fontSize: 13 }}>Clé « {freshToken.name} » créée — copie-la maintenant :</strong>
          <code style={{ display: "block", marginTop: 8, fontSize: 12.5, wordBreak: "break-all", userSelect: "all" }}>
            {freshToken.token}
          </code>
          <button className="btn-ghost" style={{ marginTop: 10, fontSize: 12.5 }}
            onClick={() => { void navigator.clipboard.writeText(freshToken.token); }}>
            Copier
          </button>
          <button className="btn-ghost" style={{ marginTop: 10, marginLeft: 8, fontSize: 12.5 }}
            onClick={() => setFreshToken(null)}>
            J'ai copié, masquer
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Nom du client (ex. La Dépêche du Var)"
          style={{
            flex: "1 1 260px", maxWidth: 380, fontSize: 13, padding: "8px 10px",
            borderRadius: 8, border: "1px solid var(--muted)",
            background: "transparent", color: "inherit",
          }}
        />
        <button className="btn-ghost" onClick={createKey} disabled={newKeyName.trim().length < 2}>
          + Créer une clé
        </button>
      </div>

      {keys.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {keys.map((k, i) => (
            <div key={k.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              borderTop: i > 0 ? "1px solid var(--muted)" : "none", fontSize: 13,
              opacity: k.active ? 1 : 0.5,
            }}>
              <strong>{k.name}</strong>
              <code style={{ fontSize: 12 }}>{k.keyPrefix}…</code>
              <span style={{ color: "var(--muted)", fontSize: 11.5, marginLeft: "auto" }}>
                {k.lastUsedAt
                  ? `dernier appel ${new Date(k.lastUsedAt).toLocaleString("fr-FR")}`
                  : "jamais utilisée"}
              </span>
              {k.active ? (
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => revokeKey(k.id)}>
                  Révoquer
                </button>
              ) : (
                <span style={{ fontSize: 12 }}>révoquée</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// GENERIC-HOROSCOPES-V1 admin page applied
