// ============================================================
// AUTH-UX-POLISH-V1 — auth-utils.ts
// ------------------------------------------------------------
// Utilitaires partagés entre LoginForm et RegisterForm :
//
// - formatAuthError(err): mappe les erreurs API vers des
//   messages FR. Inclut un slot "EMAIL_NOT_VERIFIED" déjà
//   prêt pour AUTH-EMAIL-VERIFY-V1 (archive 2).
//
// - isValidEmail(s): regex simple pour validation client.
//   Ne remplace pas la validation backend, sert juste à
//   donner un feedback UX rapide.
//
// - passwordStrength(p): score 0-4 basé sur longueur +
//   diversité de caractères. Informatif uniquement —
//   le seul critère bloquant côté backend est minLength 8.
// ============================================================

// ----------------------------------------------------------
// Email
// ----------------------------------------------------------
// Validation côté client volontairement plus stricte que la regex
// AJV-formats utilisée côté backend, pour donner un feedback fiable
// au blur avant de hit le serveur sur deux cas réels qui sortaient en
// erreur générique :
//   - points consécutifs / en début / en fin de local part
//     (Gmail/etc. ne délivrent pas à l adresse saisie)
//   - caractères non-ASCII (un autocomplete mobile peut transformer
//     deux points en U+2025 ou U+2026, qui passent une regex laxiste
//     mais se font jeter par AJV côté backend)
// On ne tente pas de couvrir 100% de la RFC : les caractères exotiques
// rarement utilisés (apostrophe, backtick, etc.) seront rejetés côté
// client mais acceptés côté backend, et formatAuthError les renverra
// alors en message lisible si l utilisateur en a besoin.
const EMAIL_RE = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

// ----------------------------------------------------------
// Password strength
// ----------------------------------------------------------
export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;  // CSS color (var(--xxx) ou hex)
}

export function passwordStrength(p: string): PasswordStrengthResult {
  if (!p) {
    return { score: 0, label: "—", color: "var(--border-soft)" };
  }
  if (p.length < 8) {
    return { score: 0, label: "Trop court", color: "var(--tension)" };
  }
  let score = 1;
  if (p.length >= 12)                 score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p))                score++;
  if (/[^a-zA-Z0-9]/.test(p))         score++;
  // Plafonner à 4
  if (score > 4) score = 4;

  switch (score) {
    case 1: return { score: 1, label: "Faible",     color: "#d97706" };  // amber
    case 2: return { score: 2, label: "Moyen",      color: "#ca8a04" };  // yellow
    case 3: return { score: 3, label: "Fort",       color: "#65a30d" };  // lime
    case 4: return { score: 4, label: "Très fort",  color: "#16a34a" };  // green
    default: return { score: 0, label: "—",          color: "var(--border-soft)" };
  }
}

// ----------------------------------------------------------
// Error formatting
// ----------------------------------------------------------
// Le backend Fastify renvoie des erreurs sous la forme :
//   { success: false, error: { code: "INVALID_CREDENTIALS", message: "..." } }
// Le client (apiClient) jette une Error dont le message peut
// être :
//   - "INVALID_CREDENTIALS" (code direct)
//   - "Email or password incorrect" (message backend)
//   - autre (message inattendu)
// On gère aussi le cas réseau (failed to fetch, timeout)
// et le cas rate limit (429).

interface ErrorWithStatus { status?: number; statusCode?: number; code?: string; message?: string }

export function formatAuthError(err: unknown): string {
  if (!err) return "Une erreur est survenue. Réessaie ou contacte-nous.";

  const e = err as ErrorWithStatus;
  const status = e.status ?? e.statusCode;
  const code   = (e.code ?? "").toUpperCase();
  const msg    = (e.message ?? "").toString();

  // ----- Network / fetch errors -----
  if (msg.match(/failed to fetch|networkerror|network request failed|load failed/i)) {
    return "Connexion impossible. Vérifie ta connexion internet.";
  }
  if (msg.match(/timeout|timed out|aborted/i)) {
    return "La requête a pris trop de temps. Réessaie.";
  }

  // ----- Status-based mapping -----
  if (status === 429) {
    return "Trop de tentatives. Réessaie dans une minute.";
  }
  if (status === 401 || code === "INVALID_CREDENTIALS" || msg.match(/invalid credentials|email.*incorrect|password.*incorrect/i)) {
    return "Email ou mot de passe incorrect.";
  }
  if (status === 409 || code === "EMAIL_TAKEN" || msg.match(/already (registered|exists|taken)|email.*pris/i)) {
    return "Cette adresse est déjà utilisée. Essaie de te connecter.";
  }

  // ERROR-SHAPE-V1 : le backend renvoie VALIDATION_ERROR (status 400) quand
  // AJV refuse un champ — typiquement un email mal formé (espace,
  // caractère non-ASCII issu d'un autocomplete mobile, double point…).
  // Avant ce mapping, l'utilisateur voyait le fallback générique
  // "Une erreur est survenue" et n'avait aucun moyen de comprendre.
  if (code === "VALIDATION_ERROR" || (status === 400 && msg.match(/email|format/i))) {
    const e2 = err as { details?: { field?: string } };
    if (e2.details?.field === "email" || msg.match(/email/i)) {
      return "Format d'email invalide. Vérifie qu'il n'y a pas d'espace ou de caractère bizarre.";
    }
    if (e2.details?.field === "password") {
      return "Mot de passe invalide. 8 caractères minimum.";
    }
    if (e2.details?.field === "name") {
      return "Nom invalide. 1 à 100 caractères.";
    }
    return "Certains champs sont invalides. Vérifie ta saisie.";
  }

  // ----- ACCOUNT-DELETE-V1 : compte programmé pour suppression -----
  // NOTE : LoginForm intercepte ce code AVANT formatAuthError pour afficher
  // le bandeau spécial avec bouton "Annuler la suppression". Ce mapping sert
  // de fallback pour les autres usages éventuels.
  if (code === "ACCOUNT_DELETION_PENDING") {
    return "Ton compte est programmé pour suppression. Annule la suppression ou attends son effacement définitif.";
  }

  // ----- Slot pour AUTH-EMAIL-VERIFY-V1 (archive 2) -----
  // Quand le backend renverra 403 EMAIL_NOT_VERIFIED après le hard block,
  // ce mapping fera apparaître le bon message côté UI sans modif.
  if (status === 403 || code === "EMAIL_NOT_VERIFIED" || msg.match(/email.*not.*verified|not.*activated/i)) {
    return "Ton compte n'est pas encore activé. Vérifie tes emails — un lien d'activation t'a été envoyé.";
  }

  // ----- Fallback -----
  return "Une erreur est survenue. Réessaie ou contacte-nous.";
}

// ----------------------------------------------------------
// Timezone detection (côté client)
// ----------------------------------------------------------
// Détecte la timezone IANA du navigateur. Le backend l'accepte
// en payload register (optional, isValidTz côté Fastify).
// Si pas dispo (navigateur très ancien), retourne undefined.
export function detectClientTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && typeof tz === "string" ? tz : undefined;
  } catch {
    return undefined;
  }
}

// AUTH-UX-POLISH-V1 applied

// ARCHIVE-INPUTFIELD-FIX-V1 applied
