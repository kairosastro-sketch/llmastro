// CI-FRESH-DB-V3-GATES — test-entitlements-gates.mjs
//
// Smoke test HTTP des gates d'entitlements. Tourne contre une API live
// (typiquement le container API démarré par fresh-db-test.sh). Crée un
// user éphémère, le bascule sur le plan "free" via /subscriptions/dev/set-plan,
// puis vérifie que les gates renvoient bien 403 sur les routes qui sont
// hors plan free.
//
// Couvre :
//   • POST /natal              → 1er profil OK, 2e profil 403 natal.profiles.max
//   • GET  /transits/current   → 403 transits.biwheel
//   • POST /horoscope/tarot    → 5 tirages OK, 6e 429 tarot (quota mensuel)
//   • POST /compat/analyze     → 1 synastry OK, 2e 429 synastry (quota mensuel)
//   • POST /ai/horoscope day   → 5 horoscopes OK, 6e 429 horoscope.day (quota mensuel)
//
// Pré-requis côté API (imposé par fresh-db-test.sh au démarrage container) :
//   • ENTITLEMENTS_ENFORCED=true
//   • DEV_PLAN_SWITCH=true
//
// Env vars :
//   BASE_URL    URL de l'API (défaut http://localhost:4000)
//   TEST_EMAIL  email du user de test (doit être unique par run)

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";
const TEST_EMAIL = process.env.TEST_EMAIL ?? `gates-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPass123!";

async function jpost(path, body, token) {
  const r = await fetch(BASE_URL + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

async function jget(path, token) {
  const r = await fetch(BASE_URL + path, {
    headers: token ? { authorization: "Bearer " + token } : {},
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

const steps = [];
let failed = false;

function record(name, ok, info) {
  steps.push({ name, ok, info });
  if (!ok) failed = true;
}

(async () => {
  try {
    // 1. Register — l'API démarre par défaut en trial Essential 7j.
    const reg = await jpost("/auth/register", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: "Gates Test",
    });
    record("register", reg.status === 201, { status: reg.status });
    if (reg.status !== 201) {
      throw new Error(`register failed: ${JSON.stringify(reg.data)}`);
    }
    const token = reg.data?.data?.tokens?.accessToken;
    if (!token) throw new Error("register did not return accessToken");

    // 2. Switch sur le plan "free" via l'endpoint dev (DEV_PLAN_SWITCH=true).
    const sw = await jpost("/subscriptions/dev/set-plan", { planCode: "free" }, token);
    record("dev-set-plan-free", sw.status === 200, { status: sw.status });
    if (sw.status !== 200) {
      throw new Error(`dev/set-plan failed: ${JSON.stringify(sw.data)}`);
    }

    // 3. Premier profil natal (autorisé : max=1 sur free).
    const natalBody = {
      label:        "TestSelf",
      birthDate:    "1990-05-15",
      birthTime:    "14:30",
      latitude:     48.8566,
      longitude:    2.3522,
      timezone:     "Europe/Paris",
      birthCity:    "Paris",
      birthCountry: "France",
    };
    const n1 = await jpost("/natal", natalBody, token);
    record("natal-create-1", n1.status === 201, { status: n1.status });
    if (n1.status !== 201) {
      throw new Error(`natal #1 failed: ${JSON.stringify(n1.data)}`);
    }
    const firstNatalId = n1.data?.data?.profile?.id;
    if (!firstNatalId) throw new Error("natal #1 did not return id");

    // 4. Deuxième profil natal (doit être bloqué par natal.profiles.max=1).
    const n2 = await jpost("/natal", { ...natalBody, label: "TestSelf2" }, token);
    const n2Feature = n2.data?.error?.feature;
    record(
      "natal-create-2-blocked",
      n2.status === 403 && n2Feature === "natal.profiles.max",
      { status: n2.status, feature: n2Feature, code: n2.data?.error?.code },
    );

    // 5. Biwheel transits (transits.biwheel=false sur free → 403).
    const tb = await jget(`/transits/current/${firstNatalId}`, token);
    const tbFeature = tb.data?.error?.feature;
    record(
      "transits-biwheel-blocked",
      tb.status === 403 && tbFeature === "transits.biwheel",
      { status: tb.status, feature: tbFeature, code: tb.data?.error?.code },
    );

    // 6. Tarot quota free = 5/mois. Les 5 premiers passent, le 6e renvoie 429.
    let tarotOkCount = 0;
    for (let i = 1; i <= 5; i++) {
      const tr = await jpost("/horoscope/tarot", { natalId: firstNatalId }, token);
      if (tr.status === 200 || tr.status === 201) tarotOkCount++;
    }
    record("tarot-5-allowed", tarotOkCount === 5, { okCount: tarotOkCount });

    const t6 = await jpost("/horoscope/tarot", { natalId: firstNatalId }, token);
    const t6Feature = t6.data?.error?.feature;
    record(
      "tarot-6th-blocked",
      t6.status === 429 && t6Feature === "tarot",
      { status: t6.status, feature: t6Feature, code: t6.data?.error?.code },
    );

    // 7. Synastry quota free = 1/mois. Le 1er passe (200), le 2e renvoie 429.
    // partnerA et partnerB pointent sur le seul natal sauvé — astrologiquement
    // pas pertinent mais le gate de quota est consommé avant resolvePartner.
    const synBody = {
      partnerA: { type: "saved", natalId: firstNatalId },
      partnerB: { type: "saved", natalId: firstNatalId },
    };
    const s1 = await jpost("/compat/analyze", synBody, token);
    record(
      "synastry-1-allowed",
      s1.status === 200 || s1.status === 201,
      { status: s1.status, code: s1.data?.error?.code },
    );

    const s2 = await jpost("/compat/analyze", synBody, token);
    const s2Feature = s2.data?.error?.feature;
    record(
      "synastry-2nd-blocked",
      s2.status === 429 && s2Feature === "synastry",
      { status: s2.status, feature: s2Feature, code: s2.data?.error?.code },
    );

    // 8. Horoscope du jour Kairos quota free = 5/mois (PAYWALL-V3).
    // Les 5 premiers passent (le serveur peut renvoyer 200 ou 500 selon
    // dispo xAI ; ce qui compte pour le test c'est que le 6e soit bloqué
    // par le gate quota, pas par xAI).
    let horoOkCount = 0;
    for (let i = 1; i <= 5; i++) {
      const hr = await jpost("/ai/horoscope", { natalId: firstNatalId, period: "day" }, token);
      // Le gate consume *avant* l'appel xAI : tant qu'on ne reçoit pas un 429
      // sur cet appel, c'est que la gate est passée et 1 quota a été décompté.
      if (hr.status !== 429) horoOkCount++;
    }
    record("horoscope-day-5-allowed", horoOkCount === 5, { okCount: horoOkCount });

    const h6 = await jpost("/ai/horoscope", { natalId: firstNatalId, period: "day" }, token);
    const h6Feature = h6.data?.error?.feature;
    record(
      "horoscope-day-6th-blocked",
      h6.status === 429 && h6Feature === "horoscope.day",
      { status: h6.status, feature: h6Feature, code: h6.data?.error?.code },
    );
  } catch (e) {
    record("exception", false, { message: String(e?.message ?? e) });
  }

  const result = { failed, steps };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(failed ? 1 : 0);
})();
