// ARCHIVE-3-TIERS-V1
import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, doublePrecision, integer, jsonb, date,
  bigserial, customType,
  unique, index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// [GROWTH-V1-DB] BYTEA custom type pour iban_encrypted (pgp_sym_encrypt côté service).
// La colonne est seulement lue/écrite par le service admin via raw SQL au MVP ;
// la déclaration ici permet à $inferSelect de typer correctement si on l'utilise
// plus tard via le query builder.
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() { return "bytea"; },
});

// ----------------------------------------------------------
// USERS — ajout de `timezone` pour reset quotas à minuit locale
// ----------------------------------------------------------
export const users = pgTable("users", {
  id:            uuid("id").primaryKey().defaultRandom(),
  email:         varchar("email", { length: 255 }).notNull().unique(),
  name:          varchar("name", { length: 100 }),
  avatarUrl:     text("avatar_url"),
  provider:      varchar("provider", { length: 20 }).notNull().default("local"),
  providerId:    varchar("provider_id", { length: 255 }),
  emailVerified: boolean("email_verified").notNull().default(false),
  passwordHash:  text("password_hash"),
  timezone:      varchar("timezone", { length: 64 }).notNull().default("UTC"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
  // [ACCOUNT-DELETE-V1] soft delete : NULL = actif, non-NULL = programmé pour suppression
  deletedAt:     timestamp("deleted_at"),
  // [ADMIN-FOUNDATION-V1-BACKEND] flag administrateur, sync depuis ADMIN_EMAILS au boot
  isAdmin:       boolean("is_admin").notNull().default(false),
  // [NOTIFICATIONS-V1] préférences utilisateur (toggles types, seuil, email, locale)
  preferences:   jsonb("preferences").notNull().default(sql`'{}'::jsonb`),
  // [GROWTH-V1-DB] code de parrainage public (nanoid 8 chars). Généré lazy
  // au prochain login/register par GROWTH-V1-CAPTURE — nullable ici.
  referralCode:  varchar("referral_code", { length: 12 }),
  // [GROWTH-V1-DB] parrain ayant amené ce user (null si signup direct).
  // FK self-reference enforced en DB ; AnyPgColumn cast nécessaire car
  // l'identifiant `users` n'est pas encore défini au moment du closure.
  referredBy:    uuid("referred_by").references((): AnyPgColumn => users.id),
});

// ----------------------------------------------------------
// NATAL_DATA — inchangé
// ----------------------------------------------------------
export const natalData = pgTable("natal_data", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label:            varchar("label", { length: 50 }).notNull(),
  birthDate:        varchar("birth_date", { length: 10 }).notNull(),
  birthTime:        varchar("birth_time", { length: 5 }).notNull(),
  birthTimeUnknown: boolean("birth_time_unknown").notNull().default(false),
  latitude:         doublePrecision("latitude").notNull(),
  longitude:        doublePrecision("longitude").notNull(),
  timezone:         varchar("timezone", { length: 50 }).notNull(),
  birthCity:        varchar("birth_city", { length: 100 }).notNull(),
  birthCountry:     varchar("birth_country", { length: 100 }).notNull(),
  gender:             varchar("gender", { length: 20 }).notNull().default("unspecified"),
  relationshipStatus: varchar("relationship_status", { length: 20 }).notNull().default("unspecified"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

// ----------------------------------------------------------
// REFRESH_TOKENS — inchangé
// ----------------------------------------------------------
export const refreshTokens = pgTable("refresh_tokens", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================================
// NOUVELLES TABLES — SYSTÈME DE TIERS
// ==========================================================

// ----------------------------------------------------------
// PLANS — catalogue commercial
// ----------------------------------------------------------
export const plans = pgTable("plans", {
  id:            uuid("id").primaryKey().defaultRandom(),
  code:          varchar("code", { length: 32 }).notNull().unique(),   // "free" | "essential" | "premium"
  name:          varchar("name", { length: 100 }).notNull(),
  description:   text("description").notNull().default(""),
  priceCents:    integer("price_cents").notNull().default(0),
  currency:      varchar("currency", { length: 3 }).notNull().default("EUR"),
  billingPeriod: varchar("billing_period", { length: 16 }).notNull().default("month"),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),          // nullable, rempli plus tard
  isActive:      boolean("is_active").notNull().default(true),
  sortOrder:     integer("sort_order").notNull().default(0),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

// ----------------------------------------------------------
// PLAN_ENTITLEMENTS — droits par défaut d'un plan
// ----------------------------------------------------------
export const planEntitlements = pgTable("plan_entitlements", {
  id:         uuid("id").primaryKey().defaultRandom(),
  planId:     uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  featureKey: varchar("feature_key", { length: 100 }).notNull(),
  valueType:  varchar("value_type", { length: 16 }).notNull(),   // "boolean"|"limit"|"credit"|"json"
  value:      jsonb("value").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  planFeatureUnique: unique("plan_entitlements_plan_feature_uq").on(t.planId, t.featureKey),
  planIdx:           index("plan_entitlements_plan_idx").on(t.planId),
}));

// ----------------------------------------------------------
// USER_SUBSCRIPTIONS — abonnement actif (un par user pour le MVP)
// ----------------------------------------------------------
export const userSubscriptions = pgTable("user_subscriptions", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  planId:                uuid("plan_id").notNull().references(() => plans.id),
  status:                varchar("status", { length: 16 }).notNull().default("active"),
  // "active"|"trialing"|"canceled"|"past_due"|"incomplete"
  startedAt:             timestamp("started_at").notNull().defaultNow(),
  currentPeriodEnd:      timestamp("current_period_end"),
  stripeSubscriptionId:  varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId:      varchar("stripe_customer_id", { length: 255 }),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("user_subscriptions_status_idx").on(t.status),
}));

// ----------------------------------------------------------
// USER_ENTITLEMENT_OVERRIDES — exceptions par user (admin, bêta, compensations)
// ----------------------------------------------------------
export const userEntitlementOverrides = pgTable("user_entitlement_overrides", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  featureKey: varchar("feature_key", { length: 100 }).notNull(),
  valueType:  varchar("value_type", { length: 16 }).notNull(),
  value:      jsonb("value").notNull(),
  reason:     text("reason").notNull().default(""),
  expiresAt:  timestamp("expires_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userFeatureUnique: unique("user_overrides_user_feature_uq").on(t.userId, t.featureKey),
  userIdx:           index("user_overrides_user_idx").on(t.userId),
}));

// ----------------------------------------------------------
// USER_GRANTS — add-ons one-shot (crédits + accès temporaires)
// ----------------------------------------------------------
export const userGrants = pgTable("user_grants", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  userId:                 uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  featureKey:             varchar("feature_key", { length: 100 }).notNull(),
  grantType:              varchar("grant_type", { length: 16 }).notNull(),     // "access"|"credit"
  quantity:               integer("quantity").notNull().default(1),
  consumed:               integer("consumed").notNull().default(0),
  expiresAt:              timestamp("expires_at"),
  source:                 varchar("source", { length: 16 }).notNull().default("purchase"),
  // "purchase"|"promo"|"admin"|"gift"
  stripePaymentIntentId:  varchar("stripe_payment_intent_id", { length: 255 }),
  metadata:               jsonb("metadata"),
  createdAt:              timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userFeatureIdx: index("user_grants_user_feature_idx").on(t.userId, t.featureKey),
  userExpireIdx:  index("user_grants_user_expire_idx").on(t.userId, t.expiresAt),
}));

// ----------------------------------------------------------
// USAGE_COUNTERS — compteurs de quota par période
// ----------------------------------------------------------
// periodKey : YYYY-MM-DD (jour) ou YYYY-MM (mois), calculé en tz user.
export const usageCounters = pgTable("usage_counters", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  featureKey: varchar("feature_key", { length: 100 }).notNull(),
  periodKey:  varchar("period_key", { length: 16 }).notNull(),
  count:      integer("count").notNull().default(0),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  triplet: unique("usage_counters_triplet_uq").on(t.userId, t.featureKey, t.periodKey),
  userIdx: index("usage_counters_user_idx").on(t.userId),
}));

// ==========================================================
// TYPE EXPORTS
// ==========================================================
export type User               = typeof users.$inferSelect;
export type NewUser            = typeof users.$inferInsert;
export type NatalData          = typeof natalData.$inferSelect;
export type NewNatal           = typeof natalData.$inferInsert;

export type PlanRow                 = typeof plans.$inferSelect;
export type NewPlanRow              = typeof plans.$inferInsert;
export type PlanEntitlementRow      = typeof planEntitlements.$inferSelect;
export type NewPlanEntitlementRow   = typeof planEntitlements.$inferInsert;
export type UserSubscriptionRow     = typeof userSubscriptions.$inferSelect;
export type NewUserSubscriptionRow  = typeof userSubscriptions.$inferInsert;
export type UserOverrideRow         = typeof userEntitlementOverrides.$inferSelect;
export type NewUserOverrideRow      = typeof userEntitlementOverrides.$inferInsert;
export type UserGrantRow            = typeof userGrants.$inferSelect;
export type NewUserGrantRow         = typeof userGrants.$inferInsert;
export type UsageCounterRow         = typeof usageCounters.$inferSelect;
export type NewUsageCounterRow      = typeof usageCounters.$inferInsert;

// ============================================================
// ARCHIVE-PERSISTENCE-LECTURES-IA-V1
// Persistance des lectures Kairos pour cohérence cross-device
// ============================================================
export const aiReadings = pgTable("ai_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  natalProfileId: uuid("natal_profile_id").references(() => natalData.id, {
    onDelete: "cascade",
  }),
  kind: varchar("kind", { length: 32 }).notNull(),
  readingKey: varchar("reading_key", { length: 255 }).notNull(),
  content: jsonb("content").notNull(),
  promptVersion: integer("prompt_version").notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  regeneratedAt: timestamp("regenerated_at"),
  regenCount: integer("regen_count").notNull().default(0),
});

// ARCHIVE-PERSISTENCE-LECTURES-IA-V1 schema applied

// ============================================================
// CHAT-PERSISTENCE-V1-DATA
// Conversations chat sauvegardées par l'utilisateur (feature payante).
// - chatConversations : métadonnées (planet, title, last activity)
// - chatMessages      : messages individuels (role + content)
// ============================================================
export const chatConversations = pgTable("chat_conversations", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  natalProfileId:  uuid("natal_profile_id").references(() => natalData.id, { onDelete: "set null" }),
  planetKey:       varchar("planet_key", { length: 20 }).notNull(),
  title:           varchar("title", { length: 255 }),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  lastMessageAt:   timestamp("last_message_at").notNull().defaultNow(),
}, (t) => ({
  userTimeIdx: index("chat_conversations_user_time_idx").on(t.userId, t.lastMessageAt),
}));

export const chatMessages = pgTable("chat_messages", {
  id:             uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role:           varchar("role", { length: 20 }).notNull(),
  content:        text("content").notNull(),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  convTimeIdx: index("chat_messages_conv_time_idx").on(t.conversationId, t.createdAt),
}));

export type ChatConversationRow    = typeof chatConversations.$inferSelect;
export type NewChatConversationRow = typeof chatConversations.$inferInsert;
export type ChatMessageRow         = typeof chatMessages.$inferSelect;
export type NewChatMessageRow      = typeof chatMessages.$inferInsert;

// CHAT-PERSISTENCE-V1-DATA schema applied

// ============================================================
// TAROT-PERSISTENCE-V1
// Tirages de tarot sauvegardés par l'utilisateur (feature payante).
// Un tirage est un artefact atomique : question + cartes +
// interprétation IA stockés dans un seul objet JSONB `data`
// (≠ chat, qui accumule des messages dans une table enfant).
// ============================================================
export const tarotReadings = pgTable("tarot_readings", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  natalProfileId:  uuid("natal_profile_id").references(() => natalData.id, { onDelete: "set null" }),
  title:           varchar("title", { length: 255 }),
  data:            jsonb("data").notNull(),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userTimeIdx: index("tarot_readings_user_time_idx").on(t.userId, t.createdAt),
}));

export type TarotReadingRow    = typeof tarotReadings.$inferSelect;
export type NewTarotReadingRow = typeof tarotReadings.$inferInsert;

// TAROT-PERSISTENCE-V1 schema applied


// ----------------------------------------------------------
// CITIES — base GeoNames cities500 (~185 000 villes)
// ----------------------------------------------------------
export const cities = pgTable("cities", {
  geonameid:      integer("geonameid").primaryKey(),
  name:           varchar("name", { length: 200 }).notNull(),
  asciiName:      varchar("ascii_name", { length: 200 }).notNull(),
  alternateNames: text("alternate_names").notNull().default(""),
  latitude:       doublePrecision("latitude").notNull(),
  longitude:      doublePrecision("longitude").notNull(),
  countryCode:    varchar("country_code", { length: 2 }).notNull(),
  featureCode:    varchar("feature_code", { length: 10 }).notNull(),
  population:     integer("population").notNull().default(0),
  ianaTz:         varchar("iana_tz", { length: 64 }).notNull(),
  source:         varchar("source", { length: 20 }).notNull().default("geonames"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  nameIdx:       index("idx_cities_name_trgm").on(t.name),
  asciiIdx:      index("idx_cities_ascii_trgm").on(t.asciiName),
  populationIdx: index("idx_cities_population").on(t.population),
  countryIdx:    index("idx_cities_country").on(t.countryCode),
}));

export type CityRow    = typeof cities.$inferSelect;
export type NewCityRow = typeof cities.$inferInsert;

// ============================================================
// CIEL-PUBLIC-V1-DATA-POSITIONS
// Publications éphémérides publiques (jour/semaine/mois/an).
// La colonne `data` (JSONB) est extensible : EVENTS archive y
// ajoutera un champ `events` sans nouvelle migration.
// ============================================================
export const skyPublication = pgTable("sky_publication", {
  id:              uuid("id").primaryKey().defaultRandom(),
  cadence:         varchar("cadence", { length: 10 }).notNull(),
  periodStart:     timestamp("period_start").notNull(),
  periodEnd:       timestamp("period_end").notNull(),
  data:            jsonb("data").notNull(),
  llmText:         text("llm_text"),
  llmModel:        varchar("llm_model", { length: 100 }),
  llmGeneratedAt:  timestamp("llm_generated_at"),
  // CIEL-PUBLIC-V1-LLM-PROMPT-FIX-V2 — Lecture technique
  llmTextAdvanced:         text("llm_text_advanced"),
  llmAdvancedModel:        text("llm_advanced_model"),
  llmAdvancedGeneratedAt:  timestamp("llm_advanced_generated_at"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  cadencePeriodUq: unique("sky_publication_cadence_period_uq").on(t.cadence, t.periodStart),
  lookupIdx:       index("sky_publication_lookup_idx").on(t.cadence, t.periodStart),
}));

export type SkyPublicationRow    = typeof skyPublication.$inferSelect;
export type NewSkyPublicationRow = typeof skyPublication.$inferInsert;

// CIEL-PUBLIC-V1-DATA-POSITIONS schema applied


// ============================================================
// NOTIFICATIONS-V1
// Notifications personnalisées générées par le dispatcher
// (event-relevance scoring × natal user). Phase 1 MVP : éclipses
// + lunaisons. dedup_key UNIQUE(user_id, dedup_key) garantit
// l'idempotence du dispatcher (ré-exécution sans doublons).
// ============================================================
export const notifications = pgTable("notifications", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind:         varchar("kind", { length: 32 }).notNull(),     // 'sky_event' | 'system'
  data:         jsonb("data").notNull(),                       // cf. types/notification-payload.ts
  dedupKey:     varchar("dedup_key", { length: 255 }).notNull(),
  readAt:       timestamp("read_at"),
  sentEmailAt:  timestamp("sent_email_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userDedupUq:    unique("notifications_user_dedup_uq").on(t.userId, t.dedupKey),
  userCreatedIdx: index("notifications_user_created_idx").on(t.userId, t.createdAt),
  // index partiel pour count rapide des non-lues (cf. migration 0009)
  userUnreadIdx:  index("notifications_user_unread_idx").on(t.userId, t.createdAt),
}));

export type NotificationRow    = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;

// NOTIFICATIONS-V1 schema applied


// ============================================================
// WEB-PUSH-V1
// Subscriptions Web Push API (RFC 8292) — un row par
// (user, device/navigateur). L'endpoint est l'URL unique fournie
// par le push service du navigateur (Firefox: updates.push.services.mozilla.com,
// Chrome: fcm.googleapis.com/fcm/send/..., Safari: web.push.apple.com/...).
// Les clés p256dh + auth sont fournies par PushSubscription.toJSON()
// côté client et nécessaires au chiffrement aes128gcm du payload.
// ============================================================
export const pushSubscriptions = pgTable("push_subscriptions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint:   text("endpoint").notNull(),
  p256dh:     text("p256dh").notNull(),
  auth:       text("auth").notNull(),
  // User-Agent au moment du subscribe — purement informatif (UI "supprimer
  // cet appareil"), pas utilisé pour le dispatch. Nullable car certains
  // clients ne l'envoient pas.
  userAgent:  text("user_agent"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (t) => ({
  endpointUq: unique("push_subscriptions_endpoint_uq").on(t.endpoint),
  userIdx:    index("push_subscriptions_user_idx").on(t.userId),
}));

export type PushSubscriptionRow    = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;

// WEB-PUSH-V1 schema applied


// ADMIN-FOUNDATION-V1-BACKEND applied


// ============================================================
// GROWTH-V1-DB
// Plomberie growth : parrainage user→user + affiliation influenceurs.
// Spec : GROWTH_PLAN.md à la racine. Les CHECK constraints + index
// partiels sont posés par la migration 0014 ; ici on déclare juste
// la forme TS exploitée par le query builder.
// ============================================================

// ----------------------------------------------------------
// referrals : cycle de vie d'un parrainage
// status : 'pending' → 'activated' (1er natal + 3j) → 'rewarded'
//          ou 'rejected' (filleul désinscrit avant activation)
// ----------------------------------------------------------
export const referrals = pgTable("referrals", {
  id:           uuid("id").primaryKey().defaultRandom(),
  referrerId:   uuid("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId:   uuid("referred_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  status:       varchar("status", { length: 16 }).notNull().default("pending"),
  activatedAt:  timestamp("activated_at"),
  rewardedAt:   timestamp("rewarded_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  referrerIdx:    index("referrals_referrer_idx").on(t.referrerId),
  statusTimeIdx:  index("referrals_status_time_idx").on(t.status, t.createdAt),
}));

// ----------------------------------------------------------
// gift_codes : bons cadeaux 1 mois Essentiel (parrains Pro)
// ----------------------------------------------------------
export const giftCodes = pgTable("gift_codes", {
  id:            uuid("id").primaryKey().defaultRandom(),
  code:          varchar("code", { length: 20 }).notNull().unique(),
  issuedTo:      uuid("issued_to").references(() => users.id, { onDelete: "set null" }),
  grantedPlan:   varchar("granted_plan", { length: 32 }).notNull().default("essential"),
  grantedDays:   integer("granted_days").notNull().default(30),
  expiresAt:     timestamp("expires_at").notNull(),
  redeemedBy:    uuid("redeemed_by").references(() => users.id, { onDelete: "set null" }),
  redeemedAt:    timestamp("redeemed_at"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
});

// ----------------------------------------------------------
// affiliates : compte affilié (tier + override + KYC)
// Conditions effectives résolues par resolveTerms() en service
// (cf. config/affiliate-tiers.config.ts).
// ----------------------------------------------------------
export const affiliates = pgTable("affiliates", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  userId:                   uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  slug:                     varchar("slug", { length: 40 }).notNull().unique(),
  displayName:              text("display_name").notNull(),
  status:                   varchar("status", { length: 16 }).notNull().default("pending"),
  tier:                     varchar("tier", { length: 16 }).notNull().default("standard"),
  commissionPctOverride:    integer("commission_pct_override"),
  commissionMonthsOverride: integer("commission_months_override"),
  legalName:                text("legal_name"),
  siret:                    text("siret"),
  ibanEncrypted:            bytea("iban_encrypted"),
  notes:                    text("notes"),
  createdAt:                timestamp("created_at").notNull().defaultNow(),
  updatedAt:                timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("affiliates_status_idx").on(t.status),
}));

// ----------------------------------------------------------
// affiliate_clicks : journal append-only des clics
// BIGSERIAL car volume potentiellement élevé.
// ----------------------------------------------------------
export const affiliateClicks = pgTable("affiliate_clicks", {
  id:            bigserial("id", { mode: "number" }).primaryKey(),
  affiliateId:   uuid("affiliate_id").notNull().references(() => affiliates.id),
  visitorHash:   text("visitor_hash").notNull(),
  landingUrl:    text("landing_url"),
  utmSource:     text("utm_source"),
  utmMedium:     text("utm_medium"),
  utmCampaign:   text("utm_campaign"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  affTimeIdx:  index("affiliate_clicks_aff_time_idx").on(t.affiliateId, t.createdAt),
  visitorIdx:  index("affiliate_clicks_visitor_idx").on(t.visitorHash),
}));

// ----------------------------------------------------------
// affiliate_attributions : snapshot strict des conditions
// commission_pct + commission_months sont gravés au signup et
// ne bougent JAMAIS — même si l'affilié change de tier après.
// ----------------------------------------------------------
export const affiliateAttributions = pgTable("affiliate_attributions", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  affiliateId:        uuid("affiliate_id").notNull().references(() => affiliates.id),
  referredUserId:     uuid("referred_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  commissionPct:      integer("commission_pct").notNull(),
  commissionMonths:   integer("commission_months").notNull(),
  attributedAt:       timestamp("attributed_at").notNull().defaultNow(),
  expiresAt:          timestamp("expires_at").notNull(),
}, (t) => ({
  affiliateIdx:  index("aff_attr_affiliate_idx").on(t.affiliateId),
  expiresIdx:    index("aff_attr_expires_idx").on(t.expiresAt),
}));

// ----------------------------------------------------------
// affiliate_commissions : 1 ligne par facture Stripe attribuée
// status : accrued → invoiced → paid (ou reversed sur refund)
// ----------------------------------------------------------
export const affiliateCommissions = pgTable("affiliate_commissions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  affiliateId:      uuid("affiliate_id").notNull().references(() => affiliates.id),
  attributionId:    uuid("attribution_id").notNull().references(() => affiliateAttributions.id),
  amountCents:      integer("amount_cents").notNull(),
  periodMonth:      date("period_month").notNull(),
  status:           varchar("status", { length: 16 }).notNull().default("accrued"),
  stripeChargeId:   text("stripe_charge_id"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  affStatusPeriodIdx: index("aff_comm_aff_status_period_idx").on(t.affiliateId, t.status, t.periodMonth),
  attributionIdx:     index("aff_comm_attribution_idx").on(t.attributionId),
}));

// ----------------------------------------------------------
// affiliate_terms_history : audit log append-only
// Une ligne par modification de tier ou d'override (cf. spec A-15).
// ----------------------------------------------------------
export const affiliateTermsHistory = pgTable("affiliate_terms_history", {
  id:              bigserial("id", { mode: "number" }).primaryKey(),
  affiliateId:     uuid("affiliate_id").notNull().references(() => affiliates.id),
  changedBy:       uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  previousTier:    varchar("previous_tier", { length: 16 }),
  previousPct:     integer("previous_pct"),
  previousMonths:  integer("previous_months"),
  newTier:         varchar("new_tier", { length: 16 }),
  newPct:          integer("new_pct"),
  newMonths:       integer("new_months"),
  reason:          text("reason"),
  changedAt:       timestamp("changed_at").notNull().defaultNow(),
}, (t) => ({
  affTimeIdx: index("aff_terms_hist_aff_time_idx").on(t.affiliateId, t.changedAt),
}));

// ----------------------------------------------------------
// Types — alignés sur la convention <Entity>Row / New<Entity>Row
// ----------------------------------------------------------
export type ReferralRow                = typeof referrals.$inferSelect;
export type NewReferralRow             = typeof referrals.$inferInsert;
export type GiftCodeRow                = typeof giftCodes.$inferSelect;
export type NewGiftCodeRow             = typeof giftCodes.$inferInsert;
export type AffiliateRow               = typeof affiliates.$inferSelect;
export type NewAffiliateRow            = typeof affiliates.$inferInsert;
export type AffiliateClickRow          = typeof affiliateClicks.$inferSelect;
export type NewAffiliateClickRow       = typeof affiliateClicks.$inferInsert;
export type AffiliateAttributionRow    = typeof affiliateAttributions.$inferSelect;
export type NewAffiliateAttributionRow = typeof affiliateAttributions.$inferInsert;
export type AffiliateCommissionRow     = typeof affiliateCommissions.$inferSelect;
export type NewAffiliateCommissionRow  = typeof affiliateCommissions.$inferInsert;
export type AffiliateTermsHistoryRow   = typeof affiliateTermsHistory.$inferSelect;
export type NewAffiliateTermsHistoryRow = typeof affiliateTermsHistory.$inferInsert;

// GROWTH-V1-DB schema applied
