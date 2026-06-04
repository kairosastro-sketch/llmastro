// SEO-NOINDEX-AUTH-V1
// Les pages /auth/* (login, register, forgot/reset password, verify,
// callback) ne doivent pas être indexées : elles n'ont aucune valeur
// SEO et créeraient des résultats vides. robots.txt les bloque déjà au
// crawl, mais une page liée depuis l'extérieur pourrait être indexée
// sans contenu — d'où ce noindex explicite, appliqué à tout /auth/*.
// Les pages enfant ne définissent que `title` → ce robots est conservé
// par le merge des metadata Next.

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
