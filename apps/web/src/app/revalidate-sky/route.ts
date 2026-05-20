// ============================================================
// apps/web/src/app/revalidate-sky/route.ts
// CIEL-ISR-REVALIDATE-V1
// ------------------------------------------------------------
// Endpoint de revalidation à la demande des pages /ciel.
// Appelé par le backend (apps/api boot/init-sky) dès qu'une
// publication éphéméride change de période ou que son texte
// Kairos vient d'être généré.
//
// `revalidateTag('sky-<cadence>')` invalide d'un seul coup la
// page FR (/ciel/...) et la page EN (/en/ciel/...) — les deux
// passent par `fetchSky`, qui tague son fetch avec ce tag.
//
// Protégé par un secret partagé (header `x-revalidate-secret`).
// Hors réseau Docker interne, Caddy route /revalidate-sky vers
// le conteneur web ; le backend, lui, l'appelle en direct.
// ============================================================

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { skyCacheTag, type Cadence } from "@/lib/server/sky-fetch";

const VALID_CADENCES: readonly Cadence[] = ["day", "week", "month", "year"];

export async function POST(req: Request) {
  const expected = process.env["REVALIDATE_SECRET"];
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "revalidation not configured" },
      { status: 503 },
    );
  }

  if (req.headers.get("x-revalidate-secret") !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let cadence: unknown;
  try {
    cadence = ((await req.json()) as { cadence?: unknown })?.cadence;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof cadence !== "string" || !(VALID_CADENCES as readonly string[]).includes(cadence)) {
    return NextResponse.json(
      { ok: false, error: "cadence must be one of: day, week, month, year" },
      { status: 400 },
    );
  }

  const tag = skyCacheTag(cadence as Cadence);
  revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ ok: true, revalidated: tag });
}

// CIEL-ISR-REVALIDATE-V1 revalidate-sky route applied
