// ============================================================
// apps/web/src/components/ciel/InterpretationCard.tsx
// CIEL-PUBLIC-V1-PAGES
// ------------------------------------------------------------
// Affiche le texte d'interprétation Kairos (rempli par
// CIEL-PUBLIC-V1-LLM, prochain chantier). En attendant, mode
// dégradé honnête : "Interprétation en cours de génération".
// ============================================================

interface InterpretationCardProps {
  llmText:        string | null;
  llmGeneratedAt: string | null;
}

export function InterpretationCard({ llmText, llmGeneratedAt }: InterpretationCardProps) {
  const hasText = typeof llmText === "string" && llmText.trim().length > 0;

  return (
    <section
      className="card"
      style={{
        padding: "1.75rem",
        marginBottom: "2rem",
        background: "var(--card-bg)",
        borderColor: "var(--border-mid)",
      }}
      aria-label="Interprétation Kairos"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "1rem",
        }}
      >
        <span style={{ color: "var(--gold)", fontSize: "1.3rem" }} aria-hidden>✦</span>
        <h2
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "1.3rem",
            fontWeight: 400,
            color: "var(--gold)",
          }}
        >
          Lecture du ciel par Kairos
        </h2>
      </header>

      {hasText ? (
        <>
          <div
            style={{
              color: "var(--gold-l)",
              fontSize: "1rem",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {llmText}
          </div>
          {llmGeneratedAt && (
            <p
              style={{
                marginTop: "1rem",
                color: "var(--muted-2)",
                fontSize: "0.8rem",
                fontStyle: "italic",
              }}
            >
              Lecture générée le {new Date(llmGeneratedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}.
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          La lecture par Kairos est en cours de génération pour cette période.
          Reviens dans quelques heures pour découvrir l'interprétation.
        </p>
      )}
    </section>
  );
}

// CIEL-PUBLIC-V1-PAGES interpretation applied
