// SOCIAL-AUTOPOST-API-A1
//
// Publie le post « ciel du jour » DÉJÀ généré par daily-post.mjs sur Instagram + Pinterest,
// directement depuis le serveur via les API officielles. À lancer juste APRÈS daily-post.mjs
// (même cron). Aucune dépendance à l'API/au container llmastro : script autonome.
//
// Instagram — Graph API « Instagram login » (host graph.instagram.com)
//   1) POST /<IG_USER_ID>/media        (image_url PUBLIQUE + caption)      -> { id: creationId }
//   2) (poll) GET /<creationId>?fields=status_code  jusqu'à FINISHED
//   3) POST /<IG_USER_ID>/media_publish (creation_id)                      -> { id: mediaId }
//   ⚠ JPEG est le SEUL format accepté + média obligatoirement sur URL publique (Meta le cURL).
//   Token long-lived (60 j) rafraîchi proactivement quand il vieillit (grant ig_refresh_token).
//   Permissions requises (Accès Avancé / App Review) : instagram_business_basic,
//   instagram_business_content_publish. Pas de Page FB requise par ce chemin.
//
// Pinterest — API v5 (host api.pinterest.com/v5)
//   POST /v5/pins  { board_id, title, description, link, media_source(image_base64) }
//   Access token rafraîchi à la volée sur 401 via le refresh token (grant refresh_token).
//   Scope requis : pins:write (+ boards:read). Pas besoin d'URL publique (envoi base64).
//
// Config : scripts/social/.env (cf. .env.example). Les tokens courants (qui tournent après
// refresh) sont persistés dans scripts/social/.tokens.json — les deux fichiers sont gitignorés.
//
// ⚠ À RECONFIRMER dans les dashboards au moment du setup (ne sont PAS devinables) :
//   - IG_USER_ID (l'id du compte pro, renvoyé par /me lors de l'auth)
//   - PINTEREST_BOARD_ID (id du tableau « Ciel du jour »)
//   - les scopes Pinterest cochés sur l'app, et la version d'API IG (IG_GRAPH_VERSION).
//
// Usage :
//   node publish.mjs                 # publie le post du jour (cadence day) sur les réseaux configurés
//   node publish.mjs --dry-run       # prépare tout (JPEG, captions, refresh) sans rien publier
//   node publish.mjs --cadence week
//   node publish.mjs --date 2026-06-24
//   node publish.mjs --only instagram   # ou --only pinterest

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── CLI ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const DRY = has("dry-run");
const CADENCE = arg("cadence", "day");
const ONLY = arg("only", null); // "instagram" | "pinterest" | "twitter" | null (= tous)
const OUT_ROOT = arg("out", join(HERE, "out"));

// ── .env (parseur minimal, pas de dépendance) ───────────────
function loadEnv() {
  const path = join(HERE, ".env");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const CFG = {
  igGraphVersion: process.env.IG_GRAPH_VERSION || "v23.0",
  igUserId: process.env.IG_USER_ID || "",
  igAccessToken: process.env.IG_ACCESS_TOKEN || "",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""), // ex: https://llmastro.com/social

  pinAppId: process.env.PINTEREST_APP_ID || "",
  pinAppSecret: process.env.PINTEREST_APP_SECRET || "",
  pinAccessToken: process.env.PINTEREST_ACCESS_TOKEN || "",
  pinRefreshToken: process.env.PINTEREST_REFRESH_TOKEN || "",
  pinBoardId: process.env.PINTEREST_BOARD_ID || "",

  resendKey: process.env.RESEND_API_KEY || "",
  alertFrom: process.env.ALERT_FROM || "Llmastro <info@llmastro.com>",
  alertEmail: process.env.ALERT_EMAIL || "",

  // X / Twitter — OAuth 1.0a (4 clés, posting sur son propre compte, pas de refresh)
  xApiKey: process.env.X_API_KEY || "",
  xApiSecret: process.env.X_API_SECRET || "",
  xAccessToken: process.env.X_ACCESS_TOKEN || "",
  xAccessSecret: process.env.X_ACCESS_SECRET || "",

  link: process.env.POST_LINK || "https://llmastro.com/ciel",
};

const wantIG = (!ONLY || ONLY === "instagram") && CFG.igUserId && CFG.igAccessToken && CFG.publicBaseUrl;
const wantPin = (!ONLY || ONLY === "pinterest") && CFG.pinAccessToken && CFG.pinBoardId;
const wantX = (!ONLY || ONLY === "twitter" || ONLY === "x")
  && CFG.xApiKey && CFG.xApiSecret && CFG.xAccessToken && CFG.xAccessSecret;

// ── Persistance des tokens (ils tournent après refresh) ─────
const TOKENS_PATH = join(HERE, ".tokens.json");
function loadTokens() {
  if (existsSync(TOKENS_PATH)) {
    try { return JSON.parse(readFileSync(TOKENS_PATH, "utf8")); } catch { /* repart du .env */ }
  }
  // Amorçage depuis le .env (1er run) : on suppose les tokens fraîchement émis.
  // ⚠ On PERSISTE immédiatement le seed : sinon refreshedAt repartirait à "now"
  // à chaque exécution → ageDays toujours ~0 → le token IG ne serait JAMAIS
  // rafraîchi et expirerait silencieusement à 60 j. En le figeant dès le 1er run,
  // l'horodatage vieillit et refreshIgIfStale déclenche le refresh à >50 j.
  // (Rotation manuelle du token .env ⇒ supprimer .tokens.json pour ré-amorcer.)
  const seed = {
    ig: { accessToken: CFG.igAccessToken, refreshedAt: nowIso() },
    pinterest: { accessToken: CFG.pinAccessToken, refreshToken: CFG.pinRefreshToken },
  };
  saveTokens(seed);
  return seed;
}
function saveTokens(t) {
  if (DRY) return;
  writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2), "utf8");
}
function nowIso() { return new Date().toISOString(); }
function ageDays(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

// ── Résolution de la date du jour (Europe/Paris) ────────────
function parisDateKey() {
  // YYYY-MM-DD dans le fuseau de Paris (sans dépendance).
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return parts; // fr-CA -> "2026-06-24"
}
const DATE = arg("date", parisDateKey());
const outDir = join(OUT_ROOT, DATE);
const pngPath = join(outDir, `ciel-${CADENCE}-${DATE}.png`);
const jpgPath = join(outDir, `ciel-${CADENCE}-${DATE}.jpg`);
const captionPath = join(outDir, `caption-${CADENCE}.txt`);
const skyPath = join(outDir, `sky-${CADENCE}.json`);

// ── Helpers HTTP ────────────────────────────────────────────
async function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}
async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Conversion JPEG (Instagram refuse le PNG) ───────────────
async function ensureJpeg() {
  if (!existsSync(pngPath)) throw new Error(`PNG introuvable : ${pngPath} (daily-post.mjs a-t-il tourné ?)`);
  await sharp(pngPath).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toFile(jpgPath);
  return jpgPath;
}

// ── Captions ────────────────────────────────────────────────
function readCaption() {
  if (!existsSync(captionPath)) throw new Error(`Caption introuvable : ${captionPath}`);
  return readFileSync(captionPath, "utf8").trim();
}

// Pinterest = moteur de recherche : titre court + description ≤ 800 sans hashtags, riche en mots-clés.
function buildPinterest(fullCaption) {
  let dateLabel = `du ${DATE}`;
  try {
    const sky = JSON.parse(readFileSync(skyPath, "utf8"));
    if (sky?.periodStart) {
      const fmt = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris",
      });
      dateLabel = fmt.format(new Date(sky.periodStart));
    }
  } catch { /* fallback sur la date brute */ }

  const headerByCadence = { day: "Le ciel du", week: "Le ciel de la semaine —", month: "Le ciel du mois —" };
  const title = `${headerByCadence[CADENCE] || "Le ciel —"} ${dateLabel}`.slice(0, 100);

  // Corps : caption sans la ligne de hashtags finale, tronquée, + ligne de mots-clés recherchés.
  const noTags = fullCaption.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n").trim();
  const keywords = "astrologie · horoscope du jour · transits · pleine lune · signes du zodiaque · thème natal";
  const room = 800 - keywords.length - 2;
  let body = noTags;
  if (body.length > room) {
    const cut = body.slice(0, room);
    const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    body = (lastDot > room * 0.4 ? cut.slice(0, lastDot + 1) : cut.trim() + "…");
  }
  const description = `${body}\n${keywords}`.slice(0, 800);
  return { title, description };
}

// ── Instagram ───────────────────────────────────────────────
async function refreshIgIfStale(tokens) {
  // Le long-lived IG doit être rafraîchi au moins tous les 60 j ; on le fait à >50 j.
  if (ageDays(tokens.ig.refreshedAt) < 50) return tokens;
  console.log("• IG : token âgé > 50 j, rafraîchissement…");
  if (DRY) { console.log("  (dry-run : refresh sauté)"); return tokens; }
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tokens.ig.accessToken)}`;
  const { ok, status, json } = await getJson(url);
  if (!ok || !json.access_token) throw new Error(`IG refresh échoué (HTTP ${status}) : ${JSON.stringify(json)}`);
  tokens.ig.accessToken = json.access_token;
  tokens.ig.refreshedAt = nowIso();
  saveTokens(tokens);
  return tokens;
}

async function publishInstagram(tokens, caption) {
  const base = `https://graph.instagram.com/${CFG.igGraphVersion}/${CFG.igUserId}`;
  const token = tokens.ig.accessToken;
  const imageUrl = `${CFG.publicBaseUrl}/${DATE}/ciel-${CADENCE}-${DATE}.jpg`;

  if (DRY) { console.log(`  (dry-run) IG image_url = ${imageUrl}`); return { dryRun: true, imageUrl }; }

  // 1) conteneur
  const create = await postForm(`${base}/media`, { image_url: imageUrl, caption, access_token: token });
  if (!create.ok || !create.json.id) throw new Error(`IG /media échoué (HTTP ${create.status}) : ${JSON.stringify(create.json)}`);
  const creationId = create.json.id;

  // 2) attendre que le conteneur soit FINISHED (images : quasi immédiat, on tolère jusqu'à ~30 s)
  for (let i = 0; i < 10; i++) {
    const st = await getJson(`https://graph.instagram.com/${CFG.igGraphVersion}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const code = st.json.status_code;
    if (code === "FINISHED") break;
    if (code === "ERROR" || code === "EXPIRED") throw new Error(`IG conteneur ${code} : ${JSON.stringify(st.json)}`);
    await sleep(3000);
  }

  // 3) publier
  const pub = await postForm(`${base}/media_publish`, { creation_id: creationId, access_token: token });
  if (!pub.ok || !pub.json.id) throw new Error(`IG /media_publish échoué (HTTP ${pub.status}) : ${JSON.stringify(pub.json)}`);
  return { mediaId: pub.json.id };
}

// ── Pinterest ───────────────────────────────────────────────
async function refreshPinterest(tokens) {
  const basic = Buffer.from(`${CFG.pinAppId}:${CFG.pinAppSecret}`).toString("base64");
  const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.pinterest.refreshToken }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Pinterest refresh échoué (HTTP ${res.status}) : ${JSON.stringify(json)}`);
  tokens.pinterest.accessToken = json.access_token;
  if (json.refresh_token) tokens.pinterest.refreshToken = json.refresh_token; // rotation éventuelle
  saveTokens(tokens);
  console.log("• Pinterest : access token rafraîchi.");
  return tokens;
}

async function createPin(tokens, jpegBase64, title, description) {
  const body = JSON.stringify({
    board_id: CFG.pinBoardId,
    title,
    description,
    link: CFG.link,
    media_source: { source_type: "image_base64", content_type: "image/jpeg", data: jpegBase64 },
  });
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { authorization: `Bearer ${tokens.pinterest.accessToken}`, "content-type": "application/json" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function publishPinterest(tokens, fullCaption) {
  const { title, description } = buildPinterest(fullCaption);
  const jpegBase64 = readFileSync(jpgPath).toString("base64");

  if (DRY) { console.log(`  (dry-run) Pinterest titre = « ${title} » (desc ${description.length} car.)`); return { dryRun: true, title }; }

  let r = await createPin(tokens, jpegBase64, title, description);
  if (r.status === 401) { // token expiré -> refresh + un seul retry
    await refreshPinterest(tokens);
    r = await createPin(tokens, jpegBase64, title, description);
  }
  if (!r.ok || !r.json.id) throw new Error(`Pinterest /pins échoué (HTTP ${r.status}) : ${JSON.stringify(r.json)}`);
  return { pinId: r.json.id };
}

// ── Alerte e-mail (Resend) en cas d'échec ───────────────────
async function alert(subject, text) {
  if (!CFG.resendKey || !CFG.alertEmail) { console.warn("⚠ Alerte non envoyée (RESEND_API_KEY / ALERT_EMAIL manquants)"); return; }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${CFG.resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: CFG.alertFrom, to: CFG.alertEmail, subject, text }),
    });
  } catch (e) { console.error("⚠ Échec de l'envoi de l'alerte :", e.message); }
}

// ── X / Twitter (texte + lien, palier gratuit — pas d'image) ─
function xWeight(s) {
  // Estimation du décompte X : une URL = 23, un caractère hors BMP (emoji) = 2, sinon 1.
  const urls = (s.match(/https?:\/\/\S+/g) || []).length;
  let w = urls * 23;
  for (const ch of s.replace(/https?:\/\/\S+/g, "")) w += ch.codePointAt(0) > 0xffff ? 2 : 1;
  return w;
}
function buildTwitter(fullCaption) {
  const lines = fullCaption.split("\n").map((l) => l.trim()).filter(Boolean);
  const intro = lines[0] || "✨ Le ciel du jour";
  const moonRaw = lines.find((l) => /^[\u{1F311}-\u{1F319}]/u.test(l)) || "";
  const moon = moonRaw.split(" — ")[0]; // phase + %, sans la description (gain de place)
  const aIdx = lines.findIndex((l) => /Aspects du moment/i.test(l));
  const aspects = aIdx >= 0
    ? lines.slice(aIdx + 1).filter((l) => l && !l.startsWith("#") && !/llmastro\.com/.test(l) && !/Aspects du moment/i.test(l))
    : [];
  const tail = `→ ${CFG.link}\n#astrologie`;
  const blocks = [intro, moon].filter(Boolean);
  let text = [...blocks, tail].join("\n");
  for (const a of aspects.slice(0, 3)) {
    const candidate = [...blocks, a, tail].join("\n");
    if (xWeight(candidate) <= 275) { blocks.push(a); text = candidate; } else break;
  }
  if (xWeight(text) > 280 && moon) text = [intro, tail].join("\n"); // garde-fou ultime
  return text;
}
async function publishTwitter(fullCaption) {
  const text = buildTwitter(fullCaption);
  if (DRY) {
    console.log(`  (dry-run) X (~${xWeight(text)} car. pondérés) :\n${text.split("\n").map((l) => "    " + l).join("\n")}`);
    return { dryRun: true, text };
  }
  const { TwitterApi } = await import("twitter-api-v2"); // import paresseux : inutile pour IG/Pinterest
  const client = new TwitterApi({
    appKey: CFG.xApiKey, appSecret: CFG.xApiSecret,
    accessToken: CFG.xAccessToken, accessSecret: CFG.xAccessSecret,
  });
  const res = await client.v2.tweet(text);
  if (!res?.data?.id) throw new Error(`X /2/tweets sans id : ${JSON.stringify(res)}`);
  return { tweetId: res.data.id };
}

// ── Main ────────────────────────────────────────────────────
const results = { date: DATE, cadence: CADENCE, dryRun: DRY, instagram: null, pinterest: null, twitter: null, errors: [] };

if (!wantIG && !wantPin && !wantX) {
  console.error("Aucun réseau configuré (ou désactivé via --only). Vérifie scripts/social/.env.");
  process.exit(1);
}

// Le JPEG n'est requis que par Instagram/Pinterest (X = texte + lien, sans image).
if (wantIG || wantPin) {
  try {
    await ensureJpeg();
    console.log(`✓ JPEG prêt : ${jpgPath}`);
  } catch (e) {
    console.error("✗ Conversion JPEG :", e.message);
    await alert("[llmastro social] Échec préparation du post", `Date ${DATE} (${CADENCE})\n${e.stack || e.message}`);
    process.exit(1);
  }
}

const caption = readCaption();
let tokens = loadTokens();

if (wantIG) {
  try {
    tokens = await refreshIgIfStale(tokens);
    const r = await publishInstagram(tokens, caption);
    results.instagram = r;
    console.log(`✓ Instagram : ${DRY ? "(dry-run)" : "publié " + r.mediaId}`);
  } catch (e) {
    results.errors.push(`instagram: ${e.message}`);
    console.error("✗ Instagram :", e.message);
  }
}

if (wantPin) {
  try {
    const r = await publishPinterest(tokens, caption);
    results.pinterest = r;
    console.log(`✓ Pinterest : ${DRY ? "(dry-run)" : "publié " + r.pinId}`);
  } catch (e) {
    results.errors.push(`pinterest: ${e.message}`);
    console.error("✗ Pinterest :", e.message);
  }
}

if (wantX) {
  try {
    const r = await publishTwitter(caption);
    results.twitter = r;
    console.log(`✓ X : ${DRY ? "(dry-run)" : "publié " + r.tweetId}`);
  } catch (e) {
    results.errors.push(`twitter: ${e.message}`);
    console.error("✗ X :", e.message);
  }
}

if (!DRY) writeFileSync(join(outDir, `published-${CADENCE}.json`), JSON.stringify(results, null, 2), "utf8");

if (results.errors.length) {
  await alert(
    `[llmastro social] ${results.errors.length} échec(s) de publication — ${DATE}`,
    `Date ${DATE} (${CADENCE})\n\n${results.errors.join("\n")}\n\nDétail : ${JSON.stringify(results, null, 2)}`,
  );
  process.exit(1);
}
console.log("✓ Terminé.");
