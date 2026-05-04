// ADMIN-FOUNDATION-V1-FRONTEND
// apps/web/src/app/admin/page.tsx — redirect vers /admin/users

import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/users");
}

// ADMIN-FOUNDATION-V1-FRONTEND applied
