import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found/NotFoundView";

export const metadata: Metadata = {
  title: "Perdu dans le cosmos · 404",
  description: "Cette page a quitté son orbite. Retrouvez votre chemin dans le ciel de LLMastro.",
};

export default function NotFound() {
  return <NotFoundView />;
}
