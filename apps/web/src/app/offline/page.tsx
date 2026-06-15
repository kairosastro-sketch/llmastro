// PWA-OFFLINE-V1
// Page de repli servie par le Service Worker quand la navigation échoue
// faute de réseau (cf. public/sw.js → stratégie network-first). Volontairement
// statique et sans dépendance API : elle doit pouvoir s'afficher hors-ligne.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hors-ligne",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "1rem",
        padding: "2rem",
        background: "var(--bg)",
        color: "var(--star)",
      }}
    >
      <div style={{ fontSize: "3rem", lineHeight: 1, color: "var(--gold)" }} aria-hidden>
        ✦
      </div>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Vous êtes hors-ligne</h1>
      <p style={{ maxWidth: "28rem", margin: 0, color: "var(--muted)" }}>
        Impossible de joindre le ciel pour l’instant. Vérifiez votre connexion :
        Llmastro se rechargera dès que le réseau sera de retour.
      </p>
    </main>
  );
}

// PWA-OFFLINE-V1 applied
