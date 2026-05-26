// GROWTH-V1-AFFILIATE-UI
// Formulaire de candidature affilié. Client component — formulaire
// contrôlé + POST direct via apiClient (pas de mutation TanStack,
// l'endpoint est public et le state local suffit).
//
// Spec : GROWTH_PLAN.md (section "Application page"). L'admin
// approuve manuellement via GROWTH-V1-ADMIN, le candidat n'a aucun
// accès actif tant que son statut reste 'pending'.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Header as LandingHeader } from "@/components/landing/Header";
import { apiClient } from "@/lib/api/client";
import styles from "../affiliate.module.css";

interface FormState {
  displayName:  string;
  email:        string;
  socialHandle: string;
  audienceSize: string;
  motivation:   string;
}

const INITIAL: FormState = {
  displayName:  "",
  email:        "",
  socialHandle: "",
  audienceSize: "",
  motivation:   "",
};

export default function AffiliateApplyPage() {
  const [form, setForm]       = useState<FormState>(INITIAL);
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onChange = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    // Validation minimale côté client. Le serveur revalide (rate-limit
    // + schema Fastify), c'est juste pour épargner un round-trip.
    if (form.displayName.trim().length < 2) {
      setError("Donne-nous un nom à afficher (2 caractères minimum).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("L'email semble invalide.");
      return;
    }
    if (form.socialHandle.trim().length < 2) {
      setError("Indique au moins un compte social où on peut te trouver.");
      return;
    }

    setPending(true);
    try {
      await apiClient.post("/affiliate/apply", {
        displayName:  form.displayName.trim(),
        email:        form.email.trim().toLowerCase(),
        socialHandle: form.socialHandle.trim(),
        audienceSize: form.audienceSize || undefined,
        motivation:   form.motivation.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <main className={styles.page}>
        <LandingHeader />
        <div className={styles.container}>
          <header className={styles.hero}>
            <span className={styles.heroEyebrow}>Candidature envoyée</span>
            <h1 className={styles.heroTitle}>
              Merci, <span className={styles.heroTitleAccent}>on revient vers vous</span>
            </h1>
          </header>

          <div className={styles.formSuccessCard}>
            <h2 className={styles.formSuccessTitle}>Bien reçu ✦</h2>
            <p className={styles.formSuccessBody}>
              On lit votre candidature et on revient vers vous sous 5 jours ouvrés
              à l&apos;adresse <strong>{form.email}</strong>.
              <br /><br />
              En attendant, vous pouvez explorer Llmastro et voir ce que votre audience
              y trouverait.
            </p>
            <div style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" className={styles.ctaGhost}>Retour à l&apos;accueil</Link>
              <Link href="/pricing" className={styles.ctaPrimary}>Voir les offres</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <LandingHeader />
      <div className={styles.container}>

        <header className={styles.hero}>
          <span className={styles.heroEyebrow}>Candidature Ambassadeur</span>
          <h1 className={styles.heroTitle}>
            Parlons un peu de <span className={styles.heroTitleAccent}>vous</span>
          </h1>
          <p className={styles.heroLead}>
            Pas besoin d&apos;un CV. On veut juste comprendre votre audience et
            votre univers. Cinq champs, deux minutes.
          </p>
        </header>

        <form className={styles.formCard} onSubmit={onSubmit} noValidate>
          <div className={styles.formField}>
            <label htmlFor="displayName" className={styles.formLabel}>
              Nom à afficher
            </label>
            <input
              id="displayName"
              type="text"
              className={styles.formInput}
              value={form.displayName}
              onChange={onChange("displayName")}
              maxLength={100}
              autoComplete="name"
              required
            />
            <span className={styles.formHelp}>
              Votre nom public, comme votre audience vous connaît.
            </span>
          </div>

          <div className={styles.formField}>
            <label htmlFor="email" className={styles.formLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.formInput}
              value={form.email}
              onChange={onChange("email")}
              maxLength={255}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="socialHandle" className={styles.formLabel}>
              Comptes sociaux
            </label>
            <input
              id="socialHandle"
              type="text"
              className={styles.formInput}
              value={form.socialHandle}
              onChange={onChange("socialHandle")}
              maxLength={200}
              placeholder="@vous sur Instagram, TikTok, YouTube…"
              required
            />
            <span className={styles.formHelp}>
              Un ou plusieurs liens / handles, séparés par des virgules.
            </span>
          </div>

          <div className={styles.formField}>
            <label htmlFor="audienceSize" className={styles.formLabel}>
              Taille d&apos;audience (approximative)
            </label>
            <select
              id="audienceSize"
              className={styles.formInput}
              value={form.audienceSize}
              onChange={onChange("audienceSize")}
            >
              <option value="">Préfère ne pas dire</option>
              <option value="<1k">Moins de 1 000</option>
              <option value="1k-10k">1 000 – 10 000</option>
              <option value="10k-50k">10 000 – 50 000</option>
              <option value="50k-200k">50 000 – 200 000</option>
              <option value=">200k">Plus de 200 000</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="motivation" className={styles.formLabel}>
              Pourquoi Llmastro vous parle (facultatif)
            </label>
            <textarea
              id="motivation"
              className={styles.formTextarea}
              value={form.motivation}
              onChange={onChange("motivation")}
              maxLength={2000}
              placeholder="Quelques lignes sur ce qui vous touche dans le projet, et comment vous imaginez en parler à votre audience."
            />
          </div>

          {error && <p className={styles.formErrorMsg}>{error}</p>}

          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Link href="/affiliate" className={styles.ctaGhost}>Retour</Link>
            <button type="submit" className={styles.ctaPrimary} disabled={pending}>
              {pending ? "Envoi…" : "Envoyer ma candidature"}
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}
