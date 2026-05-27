// [ACCOUNT-EXPORT-V1]
// Service RGPD : agrège toutes les données détenues par un utilisateur
// dans un seul bundle JSON. Exclut les secrets (password hash, tokens
// d'auth, clés Web Push, identifiants Stripe internes, providerId
// OAuth, flag isAdmin).
//
// Lectures only — pas de mutation. Une seule lecture par table évite
// les N+1 ; le volume reste raisonnable pour un dump per-user.

import { eq, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  natalData,
  userSubscriptions,
  plans,
  userGrants,
  usageCounters,
  userEntitlementOverrides,
  aiReadings,
  chatConversations,
  chatMessages,
  tarotReadings,
  notifications,
  referrals,
  pushSubscriptions,
} from "../db/schema.js";

export const EXPORT_SCHEMA_VERSION = 1;

export interface AccountExportBundle {
  meta: {
    exportedAt:    string;
    schemaVersion: number;
    userId:        string;
    note:          string;
  };
  user: {
    id:            string;
    email:         string;
    name:          string | null;
    avatarUrl:     string | null;
    provider:      string;
    emailVerified: boolean;
    timezone:      string;
    preferences:   unknown;
    referralCode:  string | null;
    createdAt:     string;
    updatedAt:     string;
  };
  natalProfiles: Array<Record<string, unknown>>;
  subscription:  Record<string, unknown> | null;
  grants:        Array<Record<string, unknown>>;
  usage:         Array<Record<string, unknown>>;
  entitlementOverrides: Array<Record<string, unknown>>;
  aiReadings:    Array<Record<string, unknown>>;
  chats: Array<{
    id:            string;
    planetKey:     string;
    title:         string | null;
    createdAt:     string;
    lastMessageAt: string;
    messages:      Array<{ role: string; content: string; createdAt: string }>;
  }>;
  tarotReadings:  Array<Record<string, unknown>>;
  notifications:  Array<Record<string, unknown>>;
  referrals: {
    asReferrer:   Array<Record<string, unknown>>;
    asReferred:   Record<string, unknown> | null;
  };
  pushSubscriptions: Array<Record<string, unknown>>;
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export class AccountExportService {

  async exportForUser(userId: string): Promise<AccountExportBundle> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404, code: "USER_NOT_FOUND",
      });
    }

    const natalRows = await db
      .select()
      .from(natalData)
      .where(eq(natalData.userId, userId))
      .orderBy(asc(natalData.createdAt));

    const [subRow] = await db
      .select({
        status:           userSubscriptions.status,
        startedAt:        userSubscriptions.startedAt,
        currentPeriodEnd: userSubscriptions.currentPeriodEnd,
        planCode:         plans.code,
        planName:         plans.name,
      })
      .from(userSubscriptions)
      .leftJoin(plans, eq(plans.id, userSubscriptions.planId))
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    const grantRows = await db
      .select({
        featureKey: userGrants.featureKey,
        grantType:  userGrants.grantType,
        quantity:   userGrants.quantity,
        consumed:   userGrants.consumed,
        expiresAt:  userGrants.expiresAt,
        source:     userGrants.source,
        createdAt:  userGrants.createdAt,
      })
      .from(userGrants)
      .where(eq(userGrants.userId, userId));

    const usageRows = await db
      .select({
        featureKey: usageCounters.featureKey,
        periodKey:  usageCounters.periodKey,
        count:      usageCounters.count,
        updatedAt:  usageCounters.updatedAt,
      })
      .from(usageCounters)
      .where(eq(usageCounters.userId, userId));

    const overrideRows = await db
      .select({
        featureKey: userEntitlementOverrides.featureKey,
        valueType:  userEntitlementOverrides.valueType,
        value:      userEntitlementOverrides.value,
        reason:     userEntitlementOverrides.reason,
        expiresAt:  userEntitlementOverrides.expiresAt,
        createdAt:  userEntitlementOverrides.createdAt,
      })
      .from(userEntitlementOverrides)
      .where(eq(userEntitlementOverrides.userId, userId));

    const aiRows = await db
      .select({
        id:             aiReadings.id,
        natalProfileId: aiReadings.natalProfileId,
        kind:           aiReadings.kind,
        readingKey:     aiReadings.readingKey,
        content:        aiReadings.content,
        promptVersion:  aiReadings.promptVersion,
        model:          aiReadings.model,
        generatedAt:    aiReadings.generatedAt,
        regeneratedAt:  aiReadings.regeneratedAt,
        regenCount:     aiReadings.regenCount,
      })
      .from(aiReadings)
      .where(eq(aiReadings.userId, userId))
      .orderBy(asc(aiReadings.generatedAt));

    const convRows = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(asc(chatConversations.createdAt));

    const chats: AccountExportBundle["chats"] = [];
    for (const conv of convRows) {
      const msgs = await db
        .select({
          role:      chatMessages.role,
          content:   chatMessages.content,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id))
        .orderBy(asc(chatMessages.createdAt));

      chats.push({
        id:            conv.id,
        planetKey:     conv.planetKey,
        title:         conv.title,
        createdAt:     conv.createdAt.toISOString(),
        lastMessageAt: conv.lastMessageAt.toISOString(),
        messages: msgs.map((m) => ({
          role:      m.role,
          content:   m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    const tarotRows = await db
      .select({
        id:             tarotReadings.id,
        natalProfileId: tarotReadings.natalProfileId,
        title:          tarotReadings.title,
        data:           tarotReadings.data,
        createdAt:      tarotReadings.createdAt,
      })
      .from(tarotReadings)
      .where(eq(tarotReadings.userId, userId))
      .orderBy(asc(tarotReadings.createdAt));

    const notifRows = await db
      .select({
        id:        notifications.id,
        kind:      notifications.kind,
        data:      notifications.data,
        dedupKey:  notifications.dedupKey,
        readAt:    notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(asc(notifications.createdAt));

    // Referrals : on n'exporte JAMAIS l'id du filleul (PII d'un tiers).
    // Côté referrer, on liste seulement les statuts agrégés.
    const referrerRows = await db
      .select({
        status:      referrals.status,
        activatedAt: referrals.activatedAt,
        rewardedAt:  referrals.rewardedAt,
        createdAt:   referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const [referredRow] = await db
      .select({
        status:      referrals.status,
        activatedAt: referrals.activatedAt,
        rewardedAt:  referrals.rewardedAt,
        createdAt:   referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referredId, userId))
      .limit(1);

    // Push subscriptions : on n'exporte PAS endpoint / p256dh / auth
    // (clés cryptographiques capables de pousser un payload arbitraire).
    const pushRows = await db
      .select({
        id:         pushSubscriptions.id,
        userAgent:  pushSubscriptions.userAgent,
        createdAt:  pushSubscriptions.createdAt,
        lastSeenAt: pushSubscriptions.lastSeenAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    return {
      meta: {
        exportedAt:    new Date().toISOString(),
        schemaVersion: EXPORT_SCHEMA_VERSION,
        userId:        user.id,
        note:          "Export RGPD — données détenues par Llmastro vous concernant. Les secrets (hash de mot de passe, jetons d'authentification, clés Web Push, identifiants Stripe internes) sont exclus.",
      },
      user: {
        id:            user.id,
        email:         user.email,
        name:          user.name,
        avatarUrl:     user.avatarUrl,
        provider:      user.provider,
        emailVerified: user.emailVerified,
        timezone:      user.timezone,
        preferences:   user.preferences,
        referralCode:  user.referralCode,
        createdAt:     user.createdAt.toISOString(),
        updatedAt:     user.updatedAt.toISOString(),
      },
      natalProfiles: natalRows.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
      subscription: subRow
        ? {
            planCode:         subRow.planCode,
            planName:         subRow.planName,
            status:           subRow.status,
            startedAt:        iso(subRow.startedAt),
            currentPeriodEnd: iso(subRow.currentPeriodEnd),
          }
        : null,
      grants: grantRows.map((g) => ({
        ...g,
        expiresAt: iso(g.expiresAt),
        createdAt: g.createdAt.toISOString(),
      })),
      usage: usageRows.map((u) => ({
        ...u,
        updatedAt: u.updatedAt.toISOString(),
      })),
      entitlementOverrides: overrideRows.map((o) => ({
        ...o,
        expiresAt: iso(o.expiresAt),
        createdAt: o.createdAt.toISOString(),
      })),
      aiReadings: aiRows.map((r) => ({
        ...r,
        generatedAt:   r.generatedAt.toISOString(),
        regeneratedAt: iso(r.regeneratedAt),
      })),
      chats,
      tarotReadings: tarotRows.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      notifications: notifRows.map((n) => ({
        ...n,
        readAt:    iso(n.readAt),
        createdAt: n.createdAt.toISOString(),
      })),
      referrals: {
        asReferrer: referrerRows.map((r) => ({
          status:      r.status,
          activatedAt: iso(r.activatedAt),
          rewardedAt:  iso(r.rewardedAt),
          createdAt:   r.createdAt.toISOString(),
        })),
        asReferred: referredRow
          ? {
              status:      referredRow.status,
              activatedAt: iso(referredRow.activatedAt),
              rewardedAt:  iso(referredRow.rewardedAt),
              createdAt:   referredRow.createdAt.toISOString(),
            }
          : null,
      },
      pushSubscriptions: pushRows.map((p) => ({
        ...p,
        createdAt:  p.createdAt.toISOString(),
        lastSeenAt: p.lastSeenAt.toISOString(),
      })),
    };
  }
}

export const accountExportService = new AccountExportService();
