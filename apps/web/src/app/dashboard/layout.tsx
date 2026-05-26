"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { MobileNav } from "@/components/ui/MobileNav";
import { StarsBackground } from "@/components/ui/StarsBackground";
import { PushEnableBanner } from "@/components/notifications/PushEnableBanner";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <StarsBackground count={80} />
      <div className="app-shell">
        <Sidebar />
        <div className="main-zone">
          <MobileHeader />
          <DashboardTopbar />
          <PushEnableBanner />
          <div className="content-area">
            {children}
          </div>
          <MobileNav />
        </div>
      </div>
    </>
  );
}

// ARCHIVE-PRICING-PAGE-V2 applied

// AUTH-LOADING-TYPO-FIX-V1 applied
