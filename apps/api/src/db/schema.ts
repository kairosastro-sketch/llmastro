// ARCHIVE-3-TIERS-V1
import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, doublePrecision, integer, jsonb,
  unique, index,
} from "drizzle-orm/pg-core";

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

