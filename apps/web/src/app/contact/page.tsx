// ============================================================
// CONTACT-FORM-V1 — /contact/page.tsx
// ------------------------------------------------------------
// Server Component thin wrapper : délègue le rendu à
// ContactContent (Client), qui porte le formulaire et l'appel
// API. Même pattern que /mentions-legales et /confidentialite.
// ============================================================

import type { Metadata } from "next";
import { ContactContent } from "@/components/landing/ContactContent";

export const metadata: Metadata = {
  title: "Contact",
  alternates: { canonical: "/contact" },
  description:
    "Contactez l'équipe Llmastro — question, remarque ou demande d'assistance.",
};

export default function ContactPage() {
  return <ContactContent />;
}
