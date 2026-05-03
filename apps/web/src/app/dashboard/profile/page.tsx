"use client";

// ============================================================
// /dashboard/profile — page d'édition des profils natals
// ------------------------------------------------------------
// Liste les profils de l'utilisateur, permet d'en sélectionner un
// via un select (si plusieurs), pré-remplit NatalForm en mode
// édition, et sauvegarde via PATCH /natal/:id.
//
// Pour créer un nouveau profil, l'utilisateur va sur /dashboard/natal
// (qui conserve le flow de création). Cette page est dédiée à
// l'édition + visualisation des champs.
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { natalApi } from "@/lib/api/client";
import { NatalForm, type InitialNatalProfile } from "@/components/natal/NatalForm";
import { useT, useApp } from "@/lib/i18n";

export default function ProfilePage() {
  const { accessToken } = useAuth();
  const { locale } = useApp();
  const t = useT();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: profilesRes, isLoading } = useQuery({
    queryKey: ["natal"],
    queryFn: () => natalApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const profiles = (profilesRes as any)?.data?.profiles ?? [];

  // Auto-sélection du premier profil au chargement
  useEffect(() => {
    if (profiles.length > 0 && !selectedId) setSelectedId(profiles[0].id);
  }, [profiles, selectedId]);

  const selectedProfile = profiles.find((p: any) => p.id === selectedId);

  if (isLoading) {
    return (
      <div className="page-root">
        <div className="flex-center" style={{ padding: 60 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="page-root">
        <div className="empty-state animate-fade-up">
          <div className="ico">✦</div>
          <p className="msg">
            {locale === "fr"
              ? "Aucun profil natal trouvé."
              : "No natal profile yet."}
          </p>
          <Link
            href="/dashboard/natal"
            className="btn-ob"
            style={{ marginTop: 20, maxWidth: 280, display: "inline-block" }}
          >
            {locale === "fr" ? "Créer mon profil ✦" : "Create my profile ✦"}
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedProfile) return null;

  // Adapter le profil DB au format attendu par NatalForm
  const initial: InitialNatalProfile = {
    id:                  selectedProfile.id,
    label:               selectedProfile.label ?? "",
    birthDate:           selectedProfile.birthDate ?? "",
    birthTime:           selectedProfile.birthTime ?? "12:00",
    birthCity:           selectedProfile.birthCity ?? "Paris",
    birthTimeUnknown:    selectedProfile.birthTimeUnknown ?? false,
    gender:              selectedProfile.gender ?? "unspecified",
    relationshipStatus:  selectedProfile.relationshipStatus ?? "unspecified",
  };

  return (
    <div className="page-root">
      {profiles.length > 1 && (
        <div className="animate-fade-up" style={{ marginBottom: 18, maxWidth: 480, margin: "0 auto 18px" }}>
          <label className="form-label">
            {locale === "fr" ? "Profil à éditer" : "Profile to edit"}
          </label>
          <select value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value)}>
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      <NatalForm
        key={selectedProfile.id}
        mode="edit"
        initialProfile={initial}
        onCancel={() => router.push("/dashboard/natal")}
        onSuccess={() => {
          // Feedback géré en interne par NatalForm (successMsg).
          // On reste sur la page pour permettre d'autres éditions.
        }}
      />
    </div>
  );
}

// NATAL-FORM-CONTRACT-V1 applied
