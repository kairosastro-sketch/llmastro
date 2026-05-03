// ============================================================
// NATAL-LEGACY-DEPRECATE-V1
// /dashboard/profile — DÉPRÉCIÉE
// ------------------------------------------------------------
// L'édition d'un profil natal se fait maintenant via le bouton
// "Modifier" sur /dashboard/natal (cf. NATAL-MAIN-PAGE-EXPAND-V1).
// Ce redirect préserve les bookmarks utilisateurs existants.
// ============================================================

import { redirect } from "next/navigation";

export default function ProfilePageRedirect(): never {
  redirect("/dashboard/natal");
}

// NATAL-LEGACY-DEPRECATE-V1 applied
