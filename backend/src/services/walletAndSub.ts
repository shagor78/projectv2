import { and, eq, ne } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../../database/index.ts';
import {
  auditLogs,
  packages,
  payments,
  subscriptions,
  users,
  wallets,
  walletTransactions,
} from '../../../database/schema/index.ts';

export class BusinessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function ensureUserWallet(userId: number) {
  const [existing] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(wallets)
    .values({ userId, balanceCents: 0, currency: 'USD' })
    .onConflictDoNothing({ target: wallets.userId })
    .returning();
  if (created) return created;
  const [fetched] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  return fetched;
}

export async function adjustWalletBalance(params: {
  userId: number;
  deltaCents: number;
  type: 'credit' | 'debit' | 'admin_credit' | 'admin_debit' | 'refund';
  referenceKey: string;
  description: string;
  performedByUserId?: number | null;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isInteger(params.deltaCents) || params.deltaCents === 0) {
    throw new BusinessError('Transaction amount must be a non-zero integer in cents');
  }

  return db.transaction(async (tx) => {
    const [existingTx] = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.referenceKey, params.referenceKey));

    if (existingTx) {
      throw new BusinessError('Duplicate transaction reference detected', 409);
    }

    let [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, params.userId));
    if (!wallet) {
      [wallet] = await tx
        .insert(wallets)
        .values({ userId: params.userId, balanceCents: 0, currency: 'USD' })
        .returning();
    }

    const nextBalance = wallet.balanceCents + params.deltaCents;
    if (nextBalance < 0) {
      throw new BusinessError('Insufficient wallet balance', 402);
    }

    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balanceCents: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();

    const [txRow] = await tx
      .insert(walletTransactions)
      .values({
        walletId: wallet.id,
        userId: params.userId,
        type: params.type,
        amountCents: params.deltaCents,
        balanceAfterCents: nextBalance,
        referenceKey: params.referenceKey,
        description: params.description,
        performedByUserId: params.performedByUserId ?? null,
        metadata: params.metadata ?? {},
      })
      .returning();

    if (params.type === 'admin_credit' || params.type === 'admin_debit') {
      await tx.insert(auditLogs).values({
        actorUserId: params.performedByUserId ?? null,
        actorEmail: params.actorEmail ?? 'admin',
        action: `wallet.${params.type}`,
        entityType: 'wallet',
        entityId: String(wallet.id),
        details: {
          targetUserId: params.userId,
          deltaCents: params.deltaCents,
          balanceAfterCents: nextBalance,
          referenceKey: params.referenceKey,
          description: params.description,
        },
      });
    }

    return { wallet: updatedWallet, transaction: txRow };
  });
}

export async function activateUserSubscription(params: {
  userId: number;
  packageId: number;
  paymentMethod: 'trial' | 'wallet' | 'card' | 'admin';
  referenceKey?: string;
  deviceFingerprint?: string;
  performedByUserId?: number | null;
}) {
  const refKey = params.referenceKey || `sub_${params.userId}_${params.packageId}_${crypto.randomUUID()}`;

  return db.transaction(async (tx) => {
    const [existingPayment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.referenceKey, refKey));
    if (existingPayment) {
      throw new BusinessError('Duplicate payment reference detected', 409);
    }

    const [pkg] = await tx.select().from(packages).where(eq(packages.id, params.packageId));
    if (!pkg || !pkg.isActive) {
      throw new BusinessError('Subscription package is unavailable', 404);
    }

    const [user] = await tx.select().from(users).where(eq(users.id, params.userId));
    if (!user) {
      throw new BusinessError('User not found', 404);
    }

    if (pkg.isTrial) {
      if (user.trialUsed) {
        throw new BusinessError('Free trial has already been claimed by this account', 403);
      }

      const [priorTrialSub] = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.paymentMethod, 'trial')));
      if (priorTrialSub) {
        throw new BusinessError('Free trial has already been used on this account', 403);
      }

      const fp = params.deviceFingerprint || user.trialDeviceFingerprint;
      if (fp) {
        const [deviceAbuse] = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.trialDeviceFingerprint, fp),
              eq(users.trialUsed, true),
              ne(users.id, user.id)
            )
          );
        if (deviceAbuse) {
          throw new BusinessError(
            'A free trial has already been redeemed from this device',
            403
          );
        }
      }
    }

    let walletTxRow = null;
    if (params.paymentMethod === 'wallet' && pkg.priceCents > 0) {
      let [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, user.id));
      if (!wallet) {
        [wallet] = await tx
          .insert(wallets)
          .values({ userId: user.id, balanceCents: 0, currency: 'USD' })
          .returning();
      }

      if (wallet.balanceCents < pkg.priceCents) {
        throw new BusinessError(
          `Insufficient wallet balance. Required $${(pkg.priceCents / 100).toFixed(2)}, available $${(wallet.balanceCents / 100).toFixed(2)}.`,
          402
        );
      }

      const nextBalance = wallet.balanceCents - pkg.priceCents;
      await tx
        .update(wallets)
        .set({ balanceCents: nextBalance, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));

      [walletTxRow] = await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          userId: user.id,
          type: 'debit',
          amountCents: -pkg.priceCents,
          balanceAfterCents: nextBalance,
          referenceKey: `${refKey}_wallet`,
          description: `Subscribed to ${pkg.name} (${pkg.durationDays} days)`,
          performedByUserId: params.performedByUserId ?? user.id,
          metadata: { packageId: pkg.id, packageSlug: pkg.slug },
        })
        .returning();
    }

    await tx
      .update(subscriptions)
      .set({ status: 'expired' })
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')));

    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);
    const amountPaidCents = params.paymentMethod === 'admin' || pkg.isTrial ? 0 : pkg.priceCents;

    const [sub] = await tx
      .insert(subscriptions)
      .values({
        userId: user.id,
        packageId: pkg.id,
        status: 'active',
        startsAt,
        expiresAt,
        autoRenew: false,
        paymentMethod: pkg.isTrial ? 'trial' : params.paymentMethod,
        amountPaidCents,
      })
      .returning();

    const [payment] = await tx
      .insert(payments)
      .values({
        userId: user.id,
        subscriptionId: sub.id,
        packageId: pkg.id,
        amountCents: amountPaidCents,
        currency: pkg.currency,
        provider: pkg.isTrial ? 'trial' : params.paymentMethod,
        status: 'completed',
        referenceKey: refKey,
      })
      .returning();

    if (pkg.isTrial) {
      await tx
        .update(users)
        .set({
          trialUsed: true,
          trialDeviceFingerprint: params.deviceFingerprint || user.trialDeviceFingerprint || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    return {
      subscription: sub,
      package: pkg,
      payment,
      walletTransaction: walletTxRow,
    };
  });
}
