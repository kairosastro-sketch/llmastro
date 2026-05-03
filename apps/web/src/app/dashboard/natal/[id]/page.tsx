// ============================================================
// NATAL-LEGACY-DEPRECATE-V1
// /dashboard/natal/[id] — DÉPRÉCIÉE
// ------------------------------------------------------------
// L'affichage d'un profil natal se fait maintenant sur
// /dashboard/natal (avec sélection via le sélecteur de profils).
//
// L'id du bookmark n'est PAS préservé volontairement : la page
// principale auto-sélectionne le 1er profil au mount, ce qui
// compense pour la majorité des cas. Si le deep-link via
// ?id=... devient nécessaire, ça mérite une archive dédiée
// (modifier /dashboard/natal/page.tsx pour lire le query param).
//
// La sous-route /[id]/sheet (fiche imprimable) reste active —
// c'est seulement ce page.tsx parent qui est déprécié.
// ============================================================

import { redirect } from "next/navigation";

export default function NatalIdRedirect(): never {
  redirect("/dashboard/natal");
}

// NATAL-LEGACY-DEPRECATE-V1 applied
