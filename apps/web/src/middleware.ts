// GROWTH-V1-CAPTURE
// Next.js Edge middleware : capture des paramètres d'attribution
// `?ref=` (parrainage) et `?aff=` (affiliation) et pose des cookies
// first-party que l'API lit au moment du signup.
//
// Spec : GROWTH_PLAN.md
//   - cookie `ref_code` 30 jours (P-08)
//   - cookie `aff_code` 60 jours (A-07)
//   - conflit géré côté API (règle G-03)
//
// httpOnly=true : on ne veut PAS d'accès JS côté browser. L'API lit
// les cookies directement (req.cookies via @fastify/cookie, déjà
// enregistré). Si un user souhaite saisir un code manuellement plus
// tard (formulaire), le body referralCode/affiliateSlug est prioritaire
// sur le cookie côté API.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REF_COOKIE = "ref_code";
const AFF_COOKIE = "aff_code";

const REF_TTL_SECONDS = 30 * 24 * 60 * 60;   // 30 jours
const AFF_TTL_SECONDS = 60 * 24 * 60 * 60;   // 60 jours

// Bornes de sanity sur les valeurs reçues (anti-pollution).
const REF_MAX = 12;
const AFF_MAX = 40;

// Validation alphabet : evite d'enregistrer des valeurs aberrantes.
const REF_PATTERN = /^[A-Z0-9]+$/i;
const AFF_PATTERN = /^[a-z0-9-]+$/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const ref = url.searchParams.get("ref");
  const aff = url.searchParams.get("aff");

  // Pas de query param d'attribution → passthrough, pas de réécriture.
  if (!ref && !aff) return NextResponse.next();

  const res = NextResponse.next();
  const secure = process.env.NODE_ENV === "production";

  if (ref && ref.length <= REF_MAX && REF_PATTERN.test(ref)) {
    res.cookies.set(REF_COOKIE, ref.toUpperCase(), {
      maxAge:   REF_TTL_SECONDS,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path:     "/",
    });
  }

  if (aff && aff.length <= AFF_MAX && AFF_PATTERN.test(aff)) {
    const slug = aff.toLowerCase();
    res.cookies.set(AFF_COOKIE, slug, {
      maxAge:   AFF_TTL_SECONDS,
      httpOnly: true,
      secure,
      sameSite: "lax",
      path:     "/",
    });

    // Log fire-and-forget du clic. INTERNAL_API_URL côté Docker en
    // prod (http://api:4000), localhost en dev. On ne `await` pas
    // pour ne pas retarder la réponse — si le call rate puis échoue,
    // c'est juste un click manqué dans les analytics.
    const apiBase = process.env.INTERNAL_API_URL ?? "http://api:4000";
    const landing = `${url.pathname}${url.search}`;
    void fetch(`${apiBase}/affiliate/clicks`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        landingUrl:  landing.length <= 2048 ? landing : null,
        utmSource:   url.searchParams.get("utm_source")   ?? undefined,
        utmMedium:   url.searchParams.get("utm_medium")   ?? undefined,
        utmCampaign: url.searchParams.get("utm_campaign") ?? undefined,
      }),
    }).catch(() => { /* silencieux — fire-and-forget */ });
  }

  return res;
}

// Limite l'exécution du middleware aux pages, pas aux assets statiques.
// Pattern aligné sur les défauts Next.js (skip _next/, api/, *.svg, etc.).
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml)$).*)",
  ],
};
