"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { MobileNav } from "@/components/ui/MobileNav";
import { StarsBackground } from "@/components/ui/StarsBackground";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  if (isLoading) {
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
          <div className="content-area">
            {children}
          </div>
          <MobileNav />
        </div>
      </div>
    </>
  );
}
