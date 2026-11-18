import { Router } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../../database/index.ts';
import {
  channels,
  contents,
  episodes,
  favorites,
  notifications,
  packages,
  payments,
  subscriptions,
  userDevices,
  walletTransactions,
  watchHistory,
} from '../../../database/schema/index.ts';
import { type AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  activateUserSubscription,
  adjustWalletBalance,
  BusinessError,
  ensureUserWallet,
} from '../services/walletAndSub.ts';

const router = Router();
router.use(requireAuth);

router.get('/user/dashboard', async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const wallet = await ensureUserWallet(userId);

    const [subRows, txRows, historyRows, favRows, deviceRows, notifRows] = await Promise.all([
      db
        .select({ subscription: subscriptions, package: packages })
        .from(subscriptions)
        .innerJoin(packages, eq(subscriptions.packageId, packages.id))
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt)),
      db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(20),
      db
        .select({
          history: watchHistory,
          content: contents,
          episode: episodes,
          channel: channels,
        })
        .from(watchHistory)
        .leftJoin(contents, eq(watchHistory.contentId, contents.id))
        .leftJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .leftJoin(channels, eq(watchHistory.channelId, channels.id))
        .where(eq(watchHistory.userId, userId))
        .orderBy(desc(watchHistory.lastWatchedAt))
        .limit(15),
      db
        .select({
          favorite: favorites,
          content: contents,
          channel: channels,
        })
        .from(favorites)
        .leftJoin(contents, eq(favorites.contentId, contents.id))
        .leftJoin(channels, eq(favorites.channelId, channels.id))
        .where(eq(favorites.userId, userId))
        .orderBy(desc(favorites.createdAt)),
      db
        .select()
        .from(userDevices)
        .where(and(eq(userDevices.userId, userId), eq(userDevices.isRevoked, false)))
        .orderBy(desc(userDevices.lastActiveAt)),
      db
        .select()
        .from(notifications)
        .where(or(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(15),
    ]);

    const activeSubscription = subRows.find(
      (r) => r.subscription.status === 'active' && new Date(r.subscription.expiresAt) > new Date()
    );

    res.json({
      user: req.currentUser,
      wallet,
      activeSubscription: activeSubscription
        ? { ...activeSubscription.subscription, package: activeSubscription.package }
        : null,
      subscriptionHistory: subRows.map((r) => ({ ...r.subscription, package: r.package })),
      transactions: txRows,
      watchHistory: historyRows,
      favorites: favRows,
      devices: deviceRows,
      notifications: notifRows,
    });
  } catch (err) {
    console.error('/api/user/dashboard error:', err);
    res.status(500).json({ error: 'Failed to load user dashboard' });
  }
});

router.post('/subscriptions/subscribe', async (req: AuthRequest, res) => {
  try {
    const packageId = Number(req.body?.packageId);
    const paymentMethod = req.body?.paymentMethod || 'wallet';
    const referenceKey = req.body?.referenceKey;
    const deviceFingerprint = req.body?.deviceFingerprint;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    if (paymentMethod === 'card' && !process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({
        error:
          'External card payment gateway (Stripe) is not configured in environment variables (STRIPE_SECRET_KEY missing). Please pay via Wallet Balance or claim your 15-day Free Access trial.',
        blocked: true,
      });
    }

    const result = await activateUserSubscription({
      userId: req.currentUser!.id,
      packageId,
      paymentMethod,
      referenceKey,
      deviceFingerprint,
      performedByUserId: req.currentUser!.id,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BusinessError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Subscription activation failed' });
  }
});

router.post('/subscriptions/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(subscriptions)
      .set({ status: 'cancelled', autoRenew: false })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, req.currentUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.get('/wallet/transactions', async (req: AuthRequest, res) => {
  try {
    const wallet = await ensureUserWallet(req.currentUser!.id);
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, req.currentUser!.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, req.currentUser!.id))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    res.json({ wallet, transactions, payments: paymentRows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load wallet ledger' });
  }
});

router.post('/wallet/topup', async (req: AuthRequest, res) => {
  try {
    const amountCents = Number(req.body?.amountCents);
    const referenceKey =
      typeof req.body?.referenceKey === 'string' && req.body.referenceKey.trim()
        ? req.body.referenceKey.trim()
        : `topup_${req.currentUser!.id}_${crypto.randomUUID()}`;

    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
      return res.status(400).json({ error: 'Top-up amount must be between $1.00 and $1,000.00' });
    }

    if (!process.env.STRIPE_SECRET_KEY && req.body?.provider === 'stripe') {
      return res.status(503).json({
        error:
          'Live card gateway (STRIPE_SECRET_KEY) is not configured. Ask an administrator to credit your wallet or configure Stripe.',
        blocked: true,
      });
    }

    const result = await adjustWalletBalance({
      userId: req.currentUser!.id,
      deltaCents: amountCents,
      type: 'credit',
      referenceKey,
      description: 'Wallet voucher / self-service credit',
      performedByUserId: req.currentUser!.id,
      metadata: { source: 'self_service_voucher' },
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BusinessError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Wallet credit failed' });
  }
});

router.get('/watch-history', async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        history: watchHistory,
        content: contents,
        episode: episodes,
        channel: channels,
      })
      .from(watchHistory)
      .leftJoin(contents, eq(watchHistory.contentId, contents.id))
      .leftJoin(episodes, eq(watchHistory.episodeId, episodes.id))
      .leftJoin(channels, eq(watchHistory.channelId, channels.id))
      .where(eq(watchHistory.userId, req.currentUser!.id))
      .orderBy(desc(watchHistory.lastWatchedAt))
      .limit(40);

    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load watch history' });
  }
});

router.post('/watch-history', async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const contentId = req.body?.contentId ? Number(req.body.contentId) : null;
    const episodeId = req.body?.episodeId ? Number(req.body.episodeId) : null;
    const channelId = req.body?.channelId ? Number(req.body.channelId) : null;
    const positionSeconds = Math.max(0, Math.floor(Number(req.body?.positionSeconds || 0)));
    const durationSeconds = Math.max(0, Math.floor(Number(req.body?.durationSeconds || 0)));
    const completed =
      Boolean(req.body?.completed) ||
      (durationSeconds > 30 && positionSeconds >= durationSeconds * 0.92);

    if (!contentId && !channelId) {
      return res.status(400).json({ error: 'contentId or channelId is required' });
    }

    const matchCondition = channelId
      ? and(eq(watchHistory.userId, userId), eq(watchHistory.channelId, channelId))
      : episodeId
      ? and(
          eq(watchHistory.userId, userId),
          eq(watchHistory.contentId, contentId!),
          eq(watchHistory.episodeId, episodeId)
        )
      : and(eq(watchHistory.userId, userId), eq(watchHistory.contentId, contentId!));

    const [existing] = await db.select().from(watchHistory).where(matchCondition).limit(1);

    if (existing) {
      const [updated] = await db
        .update(watchHistory)
        .set({
          positionSeconds,
          durationSeconds,
          completed,
          lastWatchedAt: new Date(),
        })
        .where(eq(watchHistory.id, existing.id))
        .returning();
      return res.json({ entry: updated });
    }

    const [created] = await db
      .insert(watchHistory)
      .values({
        userId,
        contentId,
        episodeId,
        channelId,
        positionSeconds,
        durationSeconds,
        completed,
      })
      .returning();

    res.status(201).json({ entry: created });
  } catch (err) {
    console.error('Save watch history error:', err);
    res.status(500).json({ error: 'Failed to save watch progress' });
  }
});

router.delete('/watch-history/:id', async (req: AuthRequest, res) => {
  await db
    .delete(watchHistory)
    .where(and(eq(watchHistory.id, Number(req.params.id)), eq(watchHistory.userId, req.currentUser!.id)));
  res.json({ ok: true });
});

router.delete('/watch-history', async (req: AuthRequest, res) => {
  await db.delete(watchHistory).where(eq(watchHistory.userId, req.currentUser!.id));
  res.json({ ok: true });
});

router.get('/favorites', async (req: AuthRequest, res) => {
  const rows = await db
    .select({
      favorite: favorites,
      content: contents,
      channel: channels,
    })
    .from(favorites)
    .leftJoin(contents, eq(favorites.contentId, contents.id))
    .leftJoin(channels, eq(favorites.channelId, channels.id))
    .where(eq(favorites.userId, req.currentUser!.id))
    .orderBy(desc(favorites.createdAt));

  res.json({ favorites: rows });
});

router.post('/favorites/toggle', async (req: AuthRequest, res) => {
  try {
    const userId = req.currentUser!.id;
    const contentId = req.body?.contentId ? Number(req.body.contentId) : null;
    const channelId = req.body?.channelId ? Number(req.body.channelId) : null;

    if (!contentId && !channelId) {
      return res.status(400).json({ error: 'contentId or channelId is required' });
    }

    const condition = contentId
      ? and(eq(favorites.userId, userId), eq(favorites.contentId, contentId))
      : and(eq(favorites.userId, userId), eq(favorites.channelId, channelId!));

    const [existing] = await db.select().from(favorites).where(condition).limit(1);
    if (existing) {
      await db.delete(favorites).where(eq(favorites.id, existing.id));
      return res.json({ favorited: false });
    }

    await db.insert(favorites).values({ userId, contentId, channelId });
    res.json({ favorited: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update favorites' });
  }
});

router.get('/notifications', async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(notifications)
    .where(or(eq(notifications.userId, req.currentUser!.id), eq(notifications.isRead, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  res.json({ notifications: rows });
});

router.post('/notifications/:id/read', async (req: AuthRequest, res) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
