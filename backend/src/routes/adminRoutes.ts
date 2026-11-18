import { Router } from 'express';
import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../../../database/index.ts';
import {
  adminRoles,
  auditLogs,
  channelCategories,
  channelCategoryAssignments,
  channelPlacements,
  channels,
  channelStreams,
  contentCategories,
  contentCategoryAssignments,
  contentPlacements,
  contents,
  episodes,
  excelImportLogs,
  heroSliderItems,
  homepageSectionItems,
  homepageSections,
  navigationItems,
  notifications,
  packages,
  pageHeroSliders,
  payments,
  seasons,
  sitePages,
  streamHealthLogs,
  subscriptions,
  systemSettings,
  userDevices,
  users,
  wallets,
  walletTransactions,
} from '../../../database/schema/index.ts';
import { DEFAULT_EXCEL_PATH, FRONTEND_ASSETS_IMAGES_DIR, UPLOADS_DIR } from '../config/env.ts';
import { type AuthRequest, recordAuditLog, requireAdmin } from '../middleware/auth.ts';
import { appCache, invalidatePublicCatalogCaches } from '../services/cache.ts';
import {
  generateTemplateWorkbookBuffer,
  importWorkbookBuffer,
  importWorkspaceExcelFile,
} from '../services/excelImportService.ts';
import {
  checkAndLogStream,
  recomputeChannelHealth,
  runHourlyStreamHealthSweep,
} from '../services/hlsMonitor.ts';
import {
  activateUserSubscription,
  adjustWalletBalance,
  BusinessError,
} from '../services/walletAndSub.ts';
import { normalizeStringList, slugify } from '../utils/slugify.ts';
import {
  adminCreateUserSchema,
  navigationItemSchema,
  sitePageSchema,
} from '../validators/schemas.ts';

const router = Router();
router.use(requireAdmin());

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.png').toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].includes(ext)
        ? ext
        : '.png';
      cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const excelMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function invalidateLayoutCaches() {
  invalidatePublicCatalogCaches();
}

// ---------------------------------------------------------------------------
// 1. Dashboard Overview & Reports / Analytics
// ---------------------------------------------------------------------------
router.get('/overview', async (_req, res) => {
  try {
    const [
      [{ value: totalUsers }],
      [{ value: activeSubs }],
      [{ value: totalChannels }],
      [{ value: totalContents }],
      [{ value: healthyStreams }],
      [{ value: offlineStreams }],
      [{ value: totalStreams }],
      revenueRow,
      recentLogs,
      recentPayments,
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select({ value: count() }).from(channels),
      db.select({ value: count() }).from(contents),
      db.select({ value: count() }).from(channelStreams).where(eq(channelStreams.healthStatus, 'healthy')),
      db.select({ value: count() }).from(channelStreams).where(eq(channelStreams.healthStatus, 'offline')),
      db.select({ value: count() }).from(channelStreams),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
        .from(payments)
        .where(eq(payments.status, 'completed')),
      db.select().from(streamHealthLogs).orderBy(desc(streamHealthLogs.checkedAt)).limit(12),
      db.select().from(payments).orderBy(desc(payments.createdAt)).limit(8),
    ]);

    res.json({
      kpis: {
        totalUsers,
        activeSubscriptions: activeSubs,
        totalChannels,
        totalContents,
        totalStreams,
        healthyStreams,
        offlineStreams,
        totalRevenueCents: Number(revenueRow[0]?.total || 0),
      },
      recentStreamLogs: recentLogs,
      recentPayments,
    });
  } catch (err) {
    console.error('/api/admin/overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

router.get('/analytics', async (_req, res) => {
  try {
    const [contentByType, subsByPkg, topContent, streamStats] = await Promise.all([
      db
        .select({
          contentType: contents.contentType,
          count: count(),
          views: sql<number>`coalesce(sum(${contents.viewCount}), 0)`,
        })
        .from(contents)
        .groupBy(contents.contentType),
      db
        .select({
          packageName: packages.name,
          count: count(),
          revenueCents: sql<number>`coalesce(sum(${subscriptions.amountPaidCents}), 0)`,
        })
        .from(subscriptions)
        .innerJoin(packages, eq(subscriptions.packageId, packages.id))
        .groupBy(packages.name),
      db
        .select({
          id: contents.id,
          title: contents.title,
          contentType: contents.contentType,
          viewCount: contents.viewCount,
        })
        .from(contents)
        .orderBy(desc(contents.viewCount))
        .limit(8),
      db
        .select({
          healthStatus: channelStreams.healthStatus,
          count: count(),
          avgResponseMs: sql<number>`coalesce(round(avg(${channelStreams.responseTimeMs})), 0)`,
        })
        .from(channelStreams)
        .groupBy(channelStreams.healthStatus),
    ]);

    res.json({ contentByType, subsByPkg, topContent, streamStats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ---------------------------------------------------------------------------
// 2. File Upload & Dynamic Media Library Management
// ---------------------------------------------------------------------------
router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const url = `/uploads/${req.file.filename}`;
  await recordAuditLog({
    actor: req.currentUser,
    action: 'media.upload',
    entityType: 'file',
    entityId: req.file.filename,
    details: { url, size: req.file.size },
    ipAddress: req.ip,
  });
  res.status(201).json({ url, filename: req.file.filename });
});

async function computeMediaUsageMap(): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  const addRef = (url: string | null | undefined, label: string) => {
    const clean = (url || '').trim();
    if (!clean) return;
    const list = usage.get(clean) || [];
    list.push(label);
    usage.set(clean, list);
  };

  const [allContents, allChannels, allSlides, allPages, allSettings] = await Promise.all([
    db.select({ title: contents.title, posterUrl: contents.posterUrl, backdropUrl: contents.backdropUrl }).from(contents),
    db.select({ name: channels.name, logoUrl: channels.logoUrl }).from(channels),
    db.select({ title: heroSliderItems.title, imageUrl: heroSliderItems.imageUrl, tabletImageUrl: heroSliderItems.tabletImageUrl, mobileImageUrl: heroSliderItems.mobileImageUrl }).from(heroSliderItems),
    db.select({ title: sitePages.title, heroImageUrl: sitePages.heroImageUrl }).from(sitePages),
    db.select().from(systemSettings),
  ]);

  for (const c of allContents) {
    addRef(c.posterUrl, `Content Poster: ${c.title}`);
    addRef(c.backdropUrl, `Content Backdrop: ${c.title}`);
  }
  for (const ch of allChannels) {
    addRef(ch.logoUrl, `Channel Logo: ${ch.name}`);
  }
  for (const s of allSlides) {
    addRef(s.imageUrl, `Hero Slide: ${s.title}`);
    addRef(s.tabletImageUrl, `Hero Tablet: ${s.title}`);
    addRef(s.mobileImageUrl, `Hero Mobile: ${s.title}`);
  }
  for (const p of allPages) {
    addRef(p.heroImageUrl, `Page Hero: ${p.title}`);
  }
  for (const st of allSettings) {
    if (st.key === 'logo_url' || st.key === 'favicon_url') {
      addRef(st.value, `Setting: ${st.key}`);
    }
  }

  return usage;
}

router.get('/media', async (_req, res) => {
  try {
    const usageMap = await computeMediaUsageMap();
    const assets: Array<{
      filename: string;
      url: string;
      source: 'uploads' | 'builtin';
      sizeBytes: number;
      modifiedAt: string;
      usedBy: string[];
    }> = [];

    if (fs.existsSync(UPLOADS_DIR)) {
      for (const name of fs.readdirSync(UPLOADS_DIR)) {
        const full = path.join(UPLOADS_DIR, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const url = `/uploads/${name}`;
        assets.push({
          filename: name,
          url,
          source: 'uploads',
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          usedBy: usageMap.get(url) || [],
        });
      }
    }

    if (fs.existsSync(FRONTEND_ASSETS_IMAGES_DIR)) {
      for (const name of fs.readdirSync(FRONTEND_ASSETS_IMAGES_DIR)) {
        const full = path.join(FRONTEND_ASSETS_IMAGES_DIR, name);
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const url = `/src/assets/images/${name}`;
        assets.push({
          filename: name,
          url,
          source: 'builtin',
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          usedBy: usageMap.get(url) || [],
        });
      }
    }

    assets.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    res.json({ assets });
  } catch (err) {
    console.error('/api/admin/media error:', err);
    res.status(500).json({ error: 'Failed to scan media library' });
  }
});

router.post('/media/replace', async (req: AuthRequest, res) => {
  try {
    const oldUrl = String(req.body?.oldUrl || '').trim();
    const newUrl = String(req.body?.newUrl || '').trim();
    if (!oldUrl || !newUrl) {
      return res.status(400).json({ error: 'oldUrl and newUrl are required' });
    }

    let replacedRefs = 0;
    await db.transaction(async (tx) => {
      const r1 = await tx.update(contents).set({ posterUrl: newUrl }).where(eq(contents.posterUrl, oldUrl)).returning({ id: contents.id });
      const r2 = await tx.update(contents).set({ backdropUrl: newUrl }).where(eq(contents.backdropUrl, oldUrl)).returning({ id: contents.id });
      const r3 = await tx.update(channels).set({ logoUrl: newUrl }).where(eq(channels.logoUrl, oldUrl)).returning({ id: channels.id });
      const r4 = await tx.update(heroSliderItems).set({ imageUrl: newUrl }).where(eq(heroSliderItems.imageUrl, oldUrl)).returning({ id: heroSliderItems.id });
      const r5 = await tx.update(sitePages).set({ heroImageUrl: newUrl }).where(eq(sitePages.heroImageUrl, oldUrl)).returning({ id: sitePages.id });
      const r6 = await tx.update(systemSettings).set({ value: newUrl, updatedAt: new Date() }).where(eq(systemSettings.value, oldUrl)).returning({ id: systemSettings.id });
      replacedRefs = r1.length + r2.length + r3.length + r4.length + r5.length + r6.length;
    });

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'media.replace',
      entityType: 'media',
      entityId: oldUrl,
      details: { oldUrl, newUrl, replacedRefs },
    });

    res.json({ ok: true, replacedRefs });
  } catch (err) {
    console.error('Replace media URL error:', err);
    res.status(500).json({ error: 'Failed to replace media references' });
  }
});

router.delete('/media/:filename', async (req: AuthRequest, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    const force = req.query.force === 'true';
    const targetPath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Uploaded file not found (only user uploads in backend/uploads can be deleted)' });
    }

    const url = `/uploads/${filename}`;
    const usageMap = await computeMediaUsageMap();
    const refs = usageMap.get(url) || [];
    if (refs.length > 0 && !force) {
      return res.status(409).json({
        error: `Asset is currently referenced by ${refs.length} item(s). Replace references or confirm force delete.`,
        usedBy: refs,
      });
    }

    fs.unlinkSync(targetPath);
    await recordAuditLog({
      actor: req.currentUser,
      action: 'media.delete',
      entityType: 'file',
      entityId: filename,
      details: { url, force },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media file' });
  }
});

// ---------------------------------------------------------------------------
// 3. Channel Categories & Live TV Channels & Unlimited HLS Streams
// ---------------------------------------------------------------------------
router.get('/channel-categories', async (_req, res) => {
  const rows = await db
    .select()
    .from(channelCategories)
    .orderBy(asc(channelCategories.sortOrder), asc(channelCategories.id));
  res.json({ categories: rows });
});

router.post('/channel-categories', async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const slug = slugify(req.body?.slug || name);
    const [created] = await db
      .insert(channelCategories)
      .values({
        name,
        slug,
        description: String(req.body?.description || ''),
        iconUrl: String(req.body?.iconUrl || ''),
        language: String(req.body?.language || 'All'),
        categoryType: String(req.body?.categoryType || 'general'),
        sortOrder: Number(req.body?.sortOrder || 0),
        isActive: req.body?.isActive !== false,
      })
      .returning();
    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'channel_category.create',
      entityType: 'channel_category',
      entityId: created.id,
      details: { name, language: created.language, categoryType: created.categoryType },
    });
    res.status(201).json({ category: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Category slug already exists' });
    res.status(500).json({ error: 'Failed to create channel category' });
  }
});

router.put('/channel-categories/reorder', async (req: AuthRequest, res) => {
  const orderedIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx
        .update(channelCategories)
        .set({ sortOrder: i + 1 })
        .where(eq(channelCategories.id, orderedIds[i]));
    }
  });
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.patch('/channel-categories/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = {};
  for (const k of ['name', 'description', 'iconUrl', 'language', 'categoryType', 'isActive']) {
    if (req.body?.[k] !== undefined) updates[k] = req.body[k];
  }
  if (req.body?.sortOrder !== undefined) updates.sortOrder = Number(req.body.sortOrder);

  const [updated] = await db
    .update(channelCategories)
    .set(updates)
    .where(eq(channelCategories.id, id))
    .returning();
  invalidateLayoutCaches();
  res.json({ category: updated });
});

router.delete('/channel-categories/:id', async (req: AuthRequest, res) => {
  await db.delete(channelCategories).where(eq(channelCategories.id, Number(req.params.id)));
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.get('/channels', async (_req, res) => {
  const [channelRows, streamRows, assignRows, cats] = await Promise.all([
    db.select().from(channels).orderBy(asc(channels.sortOrder), asc(channels.channelNumber)),
    db.select().from(channelStreams).orderBy(asc(channelStreams.priority), asc(channelStreams.id)),
    db.select().from(channelCategoryAssignments),
    db.select().from(channelCategories),
  ]);

  const catMap = new Map(cats.map((c) => [c.id, c]));
  const result = channelRows.map((ch) => ({
    ...ch,
    streams: streamRows.filter((s) => s.channelId === ch.id),
    categoryIds: assignRows.filter((a) => a.channelId === ch.id).map((a) => a.categoryId),
    categories: assignRows
      .filter((a) => a.channelId === ch.id)
      .map((a) => catMap.get(a.categoryId))
      .filter(Boolean),
  }));

  res.json({ channels: result });
});

router.post('/channels', async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Channel name is required' });
    const slug = slugify(req.body?.slug || name);
    const categoryIds: number[] = Array.isArray(req.body?.categoryIds) ? req.body.categoryIds.map(Number) : [];
    const placements: string[] = Array.isArray(req.body?.placements) ? req.body.placements : ['homepage_live'];
    const initialStreams: Array<{ label: string; streamUrl: string; priority: number }> = Array.isArray(
      req.body?.streams
    )
      ? req.body.streams
      : [];

    const [created] = await db
      .insert(channels)
      .values({
        name,
        slug,
        channelNumber: Number(req.body?.channelNumber || 100),
        logoUrl: String(req.body?.logoUrl || ''),
        description: String(req.body?.description || ''),
        country: String(req.body?.country || 'Global'),
        language: String(req.body?.language || 'English'),
        isFeatured: Boolean(req.body?.isFeatured),
        isPublished: req.body?.isPublished !== false,
        showOnHomepage: req.body?.showOnHomepage !== false,
        showOnLiveTv: req.body?.showOnLiveTv !== false,
        sortOrder: Number(req.body?.sortOrder || 0),
        placements,
      })
      .returning();

    for (const cid of categoryIds) {
      await db
        .insert(channelCategoryAssignments)
        .values({ channelId: created.id, categoryId: cid })
        .onConflictDoNothing();
    }

    for (let i = 0; i < placements.length; i += 1) {
      await db
        .insert(channelPlacements)
        .values({ channelId: created.id, placementKey: placements[i], sortOrder: i + 1 })
        .onConflictDoNothing();
    }

    for (let i = 0; i < initialStreams.length; i += 1) {
      const s = initialStreams[i];
      if (s.streamUrl?.trim()) {
        await db.insert(channelStreams).values({
          channelId: created.id,
          label: s.label || `Stream ${i + 1}`,
          streamUrl: s.streamUrl.trim(),
          priority: Number(s.priority || i + 1),
          isActive: true,
        });
      }
    }

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'channel.create',
      entityType: 'channel',
      entityId: created.id,
      details: { name, streamCount: initialStreams.length },
      ipAddress: req.ip,
    });
    res.status(201).json({ channel: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Channel slug already exists' });
    console.error('Create channel error:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

router.put('/channels/reorder', async (req: AuthRequest, res) => {
  try {
    const orderedIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await tx
          .update(channels)
          .set({ sortOrder: i + 1, updatedAt: new Date() })
          .where(eq(channels.id, orderedIds[i]));
      }
    });
    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'channels.reorder',
      entityType: 'channel',
      details: { orderedIds },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder channels' });
  }
});

router.patch('/channels/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = [
      'name',
      'channelNumber',
      'logoUrl',
      'description',
      'country',
      'language',
      'isFeatured',
      'isPublished',
      'showOnHomepage',
      'showOnLiveTv',
      'sortOrder',
      'placements',
    ];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f];
    }

    const [updated] = await db.update(channels).set(updates).where(eq(channels.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Channel not found' });

    if (Array.isArray(req.body?.categoryIds)) {
      await db.delete(channelCategoryAssignments).where(eq(channelCategoryAssignments.channelId, id));
      for (const cid of req.body.categoryIds.map(Number)) {
        await db
          .insert(channelCategoryAssignments)
          .values({ channelId: id, categoryId: cid })
          .onConflictDoNothing();
      }
    }

    if (Array.isArray(req.body?.placements)) {
      await db.delete(channelPlacements).where(eq(channelPlacements.channelId, id));
      for (let i = 0; i < req.body.placements.length; i += 1) {
        const key = String(req.body.placements[i]).trim();
        if (key) {
          await db
            .insert(channelPlacements)
            .values({ channelId: id, placementKey: key, sortOrder: i + 1 })
            .onConflictDoNothing();
        }
      }
    }

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'channel.update',
      entityType: 'channel',
      entityId: id,
      details: updates,
      ipAddress: req.ip,
    });
    res.json({ channel: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

router.delete('/channels/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(channels).where(eq(channels.id, id));
  invalidateLayoutCaches();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'channel.delete',
    entityType: 'channel',
    entityId: id,
  });
  res.json({ ok: true });
});

router.post('/channels/:id/streams', async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.id);
    const streamUrl = String(req.body?.streamUrl || '').trim();
    if (!streamUrl) return res.status(400).json({ error: 'Stream URL is required' });

    const existing = await db
      .select()
      .from(channelStreams)
      .where(eq(channelStreams.channelId, channelId));

    const [created] = await db
      .insert(channelStreams)
      .values({
        channelId,
        label: String(req.body?.label || `Stream Source ${existing.length + 1}`),
        streamUrl,
        priority: Number(req.body?.priority || existing.length + 1),
        isActive: req.body?.isActive !== false,
      })
      .returning();

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'stream.create',
      entityType: 'channel_stream',
      entityId: created.id,
      details: { channelId, priority: created.priority },
    });
    res.status(201).json({ stream: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add stream URL' });
  }
});

router.patch('/streams/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.label !== undefined) updates.label = String(req.body.label);
  if (req.body?.streamUrl !== undefined) updates.streamUrl = String(req.body.streamUrl).trim();
  if (req.body?.priority !== undefined) updates.priority = Number(req.body.priority);
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

  const [updated] = await db
    .update(channelStreams)
    .set(updates)
    .where(eq(channelStreams.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Stream not found' });

  await recomputeChannelHealth(updated.channelId);
  invalidateLayoutCaches();
  res.json({ stream: updated });
});

router.delete('/streams/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(channelStreams).where(eq(channelStreams.id, id)).returning();
  if (deleted) {
    await recomputeChannelHealth(deleted.channelId);
  }
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.post('/streams/check-all', async (_req, res) => {
  const summary = await runHourlyStreamHealthSweep();
  res.json(summary);
});

router.post('/streams/:id/test', async (req: AuthRequest, res) => {
  try {
    const result = await checkAndLogStream(Number(req.params.id), 'manual_test');
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'Failed to test stream' });
  }
});

router.post('/channels/:id/test-streams', async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.id);
    const streams = await db
      .select()
      .from(channelStreams)
      .where(eq(channelStreams.channelId, channelId))
      .orderBy(asc(channelStreams.priority));
    const results = [];
    for (const s of streams) {
      results.push(await checkAndLogStream(s.id, 'manual_test'));
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to test channel streams' });
  }
});

router.get('/stream-health-logs', async (_req, res) => {
  const logs = await db
    .select({
      log: streamHealthLogs,
      channelName: channels.name,
      streamLabel: channelStreams.label,
    })
    .from(streamHealthLogs)
    .leftJoin(channels, eq(streamHealthLogs.channelId, channels.id))
    .leftJoin(channelStreams, eq(streamHealthLogs.streamId, channelStreams.id))
    .orderBy(desc(streamHealthLogs.checkedAt))
    .limit(100);

  res.json({ logs });
});

// ---------------------------------------------------------------------------
// 4. VOD Content Management (Movies, Drama, Web Series, Sports, Tags, Seasons)
// ---------------------------------------------------------------------------
router.get('/content-categories', async (_req, res) => {
  const rows = await db.select().from(contentCategories).orderBy(asc(contentCategories.sortOrder));
  res.json({ categories: rows });
});

router.post('/content-categories', async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const [created] = await db
      .insert(contentCategories)
      .values({
        name,
        slug: slugify(req.body?.slug || name),
        contentType: String(req.body?.contentType || 'all'),
        sortOrder: Number(req.body?.sortOrder || 0),
      })
      .returning();
    invalidateLayoutCaches();
    res.status(201).json({ category: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Category already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.get('/contents', async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  const rows = type
    ? await db
        .select()
        .from(contents)
        .where(eq(contents.contentType, type))
        .orderBy(asc(contents.sortOrder), desc(contents.createdAt))
    : await db.select().from(contents).orderBy(asc(contents.sortOrder), desc(contents.createdAt));

  const ids = rows.map((r) => r.id);
  const [assignRows, seasonRows, episodeRows] = ids.length
    ? await Promise.all([
        db.select().from(contentCategoryAssignments).where(inArray(contentCategoryAssignments.contentId, ids)),
        db.select().from(seasons).where(inArray(seasons.contentId, ids)).orderBy(asc(seasons.seasonNumber)),
        db.select().from(episodes).where(inArray(episodes.contentId, ids)).orderBy(asc(episodes.episodeNumber)),
      ])
    : [[], [], []];

  const enriched = rows.map((item) => ({
    ...item,
    categoryIds: assignRows.filter((a) => a.contentId === item.id).map((a) => a.categoryId),
    seasons: seasonRows
      .filter((s) => s.contentId === item.id)
      .map((s) => ({
        ...s,
        episodes: episodeRows.filter((e) => e.seasonId === s.id),
      })),
  }));

  res.json({ contents: enriched });
});

router.post('/contents', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const contentType = String(req.body?.contentType || 'movie');
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const slug = slugify(req.body?.slug || `${title}-${Date.now().toString().slice(-4)}`);
    const placements: string[] = Array.isArray(req.body?.placements)
      ? req.body.placements
      : ['recently_added'];
    const tags = normalizeStringList(req.body?.tags);

    const [created] = await db
      .insert(contents)
      .values({
        title,
        slug,
        contentType,
        synopsis: String(req.body?.synopsis || ''),
        posterUrl: String(req.body?.posterUrl || ''),
        backdropUrl: String(req.body?.backdropUrl || ''),
        hlsUrl: String(req.body?.hlsUrl || ''),
        trailerUrl: String(req.body?.trailerUrl || ''),
        releaseDate: String(req.body?.releaseDate || new Date().toISOString().slice(0, 10)),
        releaseYear: Number(req.body?.releaseYear || new Date().getUTCFullYear()),
        durationMinutes: Number(req.body?.durationMinutes || 90),
        rating: String(req.body?.rating || 'PG-13'),
        maturityScore: String(req.body?.maturityScore || '8.5'),
        language: String(req.body?.language || 'English'),
        country: String(req.body?.country || 'International'),
        castList: Array.isArray(req.body?.castList) ? req.body.castList : [],
        tags,
        director: String(req.body?.director || ''),
        isFeatured: Boolean(req.body?.isFeatured),
        isRecentlyAdded: req.body?.isRecentlyAdded !== false,
        isPublished: req.body?.isPublished !== false,
        requiresSubscription: Boolean(req.body?.requiresSubscription),
        placements,
        sortOrder: Number(req.body?.sortOrder || 0),
      })
      .returning();

    if (Array.isArray(req.body?.categoryIds)) {
      for (const cid of req.body.categoryIds.map(Number)) {
        await db
          .insert(contentCategoryAssignments)
          .values({ contentId: created.id, categoryId: cid })
          .onConflictDoNothing();
      }
    }

    for (let i = 0; i < placements.length; i += 1) {
      await db
        .insert(contentPlacements)
        .values({ contentId: created.id, placementKey: placements[i], sortOrder: i + 1 })
        .onConflictDoNothing();
    }

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'content.create',
      entityType: contentType,
      entityId: created.id,
      details: { title },
    });
    res.status(201).json({ content: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: 'Failed to create content' });
  }
});

router.patch('/contents/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = [
      'title',
      'contentType',
      'synopsis',
      'posterUrl',
      'backdropUrl',
      'hlsUrl',
      'trailerUrl',
      'releaseDate',
      'releaseYear',
      'durationMinutes',
      'rating',
      'maturityScore',
      'language',
      'country',
      'castList',
      'director',
      'isFeatured',
      'isRecentlyAdded',
      'isPublished',
      'requiresSubscription',
      'placements',
      'sortOrder',
    ];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    }
    if (req.body?.tags !== undefined) {
      updates.tags = normalizeStringList(req.body.tags);
    }

    const [updated] = await db.update(contents).set(updates).where(eq(contents.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Content not found' });

    if (Array.isArray(req.body?.categoryIds)) {
      await db.delete(contentCategoryAssignments).where(eq(contentCategoryAssignments.contentId, id));
      for (const cid of req.body.categoryIds.map(Number)) {
        await db
          .insert(contentCategoryAssignments)
          .values({ contentId: id, categoryId: cid })
          .onConflictDoNothing();
      }
    }

    if (Array.isArray(req.body?.placements)) {
      await db.delete(contentPlacements).where(eq(contentPlacements.contentId, id));
      for (let i = 0; i < req.body.placements.length; i += 1) {
        const key = String(req.body.placements[i]).trim();
        if (key) {
          await db
            .insert(contentPlacements)
            .values({ contentId: id, placementKey: key, sortOrder: i + 1 })
            .onConflictDoNothing();
        }
      }
    }

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'content.update',
      entityType: updated.contentType,
      entityId: id,
      details: { title: updated.title },
    });
    res.json({ content: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update content' });
  }
});

router.delete('/contents/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(contents).where(eq(contents.id, id));
  invalidateLayoutCaches();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'content.delete',
    entityType: 'content',
    entityId: id,
  });
  res.json({ ok: true });
});

router.post('/contents/:contentId/seasons', async (req: AuthRequest, res) => {
  try {
    const contentId = Number(req.params.contentId);
    const seasonNumber = Number(req.body?.seasonNumber || 1);
    const [created] = await db
      .insert(seasons)
      .values({
        contentId,
        seasonNumber,
        title: String(req.body?.title || `Season ${seasonNumber}`),
        synopsis: String(req.body?.synopsis || ''),
        posterUrl: String(req.body?.posterUrl || ''),
        releaseYear: Number(req.body?.releaseYear || 2026),
        isPublished: req.body?.isPublished !== false,
      })
      .returning();
    invalidateLayoutCaches();
    res.status(201).json({ season: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Season number already exists' });
    res.status(500).json({ error: 'Failed to create season' });
  }
});

router.delete('/seasons/:id', async (req, res) => {
  await db.delete(seasons).where(eq(seasons.id, Number(req.params.id)));
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.post('/seasons/:seasonId/episodes', async (req: AuthRequest, res) => {
  try {
    const seasonId = Number(req.params.seasonId);
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    if (!season) return res.status(404).json({ error: 'Season not found' });

    const episodeNumber = Number(req.body?.episodeNumber || 1);
    const [created] = await db
      .insert(episodes)
      .values({
        seasonId,
        contentId: season.contentId,
        episodeNumber,
        title: String(req.body?.title || `Episode ${episodeNumber}`),
        synopsis: String(req.body?.synopsis || ''),
        thumbnailUrl: String(req.body?.thumbnailUrl || ''),
        hlsUrl: String(req.body?.hlsUrl || ''),
        durationMinutes: Number(req.body?.durationMinutes || 45),
        releaseDate: String(req.body?.releaseDate || '2026-01-01'),
        isPublished: req.body?.isPublished !== false,
      })
      .returning();
    invalidateLayoutCaches();
    res.status(201).json({ episode: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Episode number already exists in this season' });
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

router.delete('/episodes/:id', async (req, res) => {
  await db.delete(episodes).where(eq(episodes.id, Number(req.params.id)));
  invalidateLayoutCaches();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 5. Page-Specific Hero Sliders, Homepage Layout Builder & Placement Manager
// ---------------------------------------------------------------------------
router.get('/hero-sliders', async (_req, res) => {
  const [sliders, items] = await Promise.all([
    db.select().from(pageHeroSliders).orderBy(asc(pageHeroSliders.id)),
    db.select().from(heroSliderItems).orderBy(asc(heroSliderItems.sortOrder), asc(heroSliderItems.id)),
  ]);
  res.json({
    sliders: sliders.map((s) => ({
      ...s,
      slideCount: items.filter((i) => i.pageKey === s.pageKey).length,
    })),
  });
});

router.patch('/hero-sliders/:pageKey', async (req: AuthRequest, res) => {
  const pageKey = String(req.params.pageKey || 'home');
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.name !== undefined) updates.name = String(req.body.name);
  if (req.body?.autoplay !== undefined) updates.autoplay = Boolean(req.body.autoplay);
  if (req.body?.slideDurationMs !== undefined) {
    updates.slideDurationMs = Math.max(2000, Number(req.body.slideDurationMs));
  }
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

  const [existing] = await db
    .select()
    .from(pageHeroSliders)
    .where(eq(pageHeroSliders.pageKey, pageKey));

  let slider;
  if (existing) {
    [slider] = await db
      .update(pageHeroSliders)
      .set(updates)
      .where(eq(pageHeroSliders.id, existing.id))
      .returning();
  } else {
    [slider] = await db
      .insert(pageHeroSliders)
      .values({
        pageKey,
        name: String(req.body?.name || `${pageKey} Hero Slider`),
        autoplay: req.body?.autoplay !== false,
        slideDurationMs: Number(req.body?.slideDurationMs || 6500),
        isActive: req.body?.isActive !== false,
      })
      .returning();
  }

  invalidateLayoutCaches();
  res.json({ slider });
});

router.get('/hero-slides', async (req, res) => {
  const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey.trim() : '';
  const rows = pageKey
    ? await db
        .select()
        .from(heroSliderItems)
        .where(eq(heroSliderItems.pageKey, pageKey))
        .orderBy(asc(heroSliderItems.sortOrder), asc(heroSliderItems.id))
    : await db
        .select()
        .from(heroSliderItems)
        .orderBy(asc(heroSliderItems.pageKey), asc(heroSliderItems.sortOrder), asc(heroSliderItems.id));
  res.json({ slides: rows });
});

router.post('/hero-slides', async (req: AuthRequest, res) => {
  try {
    const pageKey = String(req.body?.pageKey || 'home');
    let [sliderRow] = await db
      .select()
      .from(pageHeroSliders)
      .where(eq(pageHeroSliders.pageKey, pageKey));
    if (!sliderRow) {
      [sliderRow] = await db
        .insert(pageHeroSliders)
        .values({ pageKey, name: `${pageKey} Hero Slider`, autoplay: true, slideDurationMs: 6500 })
        .returning();
    }

    const [created] = await db
      .insert(heroSliderItems)
      .values({
        sliderId: sliderRow.id,
        pageKey,
        title: String(req.body?.title || 'Featured Premiere'),
        subtitle: String(req.body?.subtitle || ''),
        badgeText: String(req.body?.badgeText || 'Featured'),
        categoryLabel: String(req.body?.categoryLabel || ''),
        languageLabel: String(req.body?.languageLabel || ''),
        imageUrl: String(req.body?.imageUrl || ''),
        tabletImageUrl: String(req.body?.tabletImageUrl || ''),
        mobileImageUrl: String(req.body?.mobileImageUrl || ''),
        ctaLabel: String(req.body?.ctaLabel || 'Watch Now'),
        ctaLink: String(req.body?.ctaLink || '/movies'),
        secondaryCtaLabel: String(req.body?.secondaryCtaLabel || ''),
        secondaryCtaLink: String(req.body?.secondaryCtaLink || ''),
        contentId: req.body?.contentId ? Number(req.body.contentId) : null,
        channelId: req.body?.channelId ? Number(req.body.channelId) : null,
        startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : null,
        endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
        sortOrder: Number(req.body?.sortOrder || 0),
        isActive: req.body?.isActive !== false,
      })
      .returning();

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'hero_slide.create',
      entityType: 'hero_slider_item',
      entityId: created.id,
      details: { pageKey, title: created.title },
    });
    res.status(201).json({ slide: created });
  } catch (err) {
    console.error('Create hero slide error:', err);
    res.status(500).json({ error: 'Failed to create hero slide' });
  }
});

router.put('/hero-slides/reorder', async (req, res) => {
  const orderedIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx
        .update(heroSliderItems)
        .set({ sortOrder: i + 1 })
        .where(eq(heroSliderItems.id, orderedIds[i]));
    }
  });
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.patch('/hero-slides/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = {};
  const fields = [
    'pageKey',
    'title',
    'subtitle',
    'badgeText',
    'categoryLabel',
    'languageLabel',
    'imageUrl',
    'tabletImageUrl',
    'mobileImageUrl',
    'ctaLabel',
    'ctaLink',
    'secondaryCtaLabel',
    'secondaryCtaLink',
    'sortOrder',
    'isActive',
  ];
  for (const k of fields) {
    if (req.body?.[k] !== undefined) updates[k] = req.body[k];
  }
  if (req.body?.contentId !== undefined) {
    updates.contentId = req.body.contentId ? Number(req.body.contentId) : null;
  }
  if (req.body?.channelId !== undefined) {
    updates.channelId = req.body.channelId ? Number(req.body.channelId) : null;
  }
  if (req.body?.startsAt !== undefined) {
    updates.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
  }
  if (req.body?.endsAt !== undefined) {
    updates.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  }

  const [updated] = await db
    .update(heroSliderItems)
    .set(updates)
    .where(eq(heroSliderItems.id, id))
    .returning();
  invalidateLayoutCaches();
  res.json({ slide: updated });
});

router.delete('/hero-slides/:id', async (req, res) => {
  await db.delete(heroSliderItems).where(eq(heroSliderItems.id, Number(req.params.id)));
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.get('/homepage-sections', async (_req, res) => {
  const [rows, assigned] = await Promise.all([
    db
      .select()
      .from(homepageSections)
      .orderBy(asc(homepageSections.sortOrder), asc(homepageSections.id)),
    db
      .select()
      .from(homepageSectionItems)
      .orderBy(asc(homepageSectionItems.sortOrder), asc(homepageSectionItems.id)),
  ]);
  res.json({
    sections: rows.map((sec) => ({
      ...sec,
      assignedItems: assigned.filter((a) => a.sectionId === sec.id),
    })),
  });
});

router.post('/homepage-sections', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Section title is required' });
    const [created] = await db
      .insert(homepageSections)
      .values({
        title,
        subtitle: String(req.body?.subtitle || ''),
        slug: slugify(req.body?.slug || `${title}-${Date.now().toString().slice(-4)}`),
        sectionType: String(req.body?.sectionType || 'movies'),
        layoutStyle: String(req.body?.layoutStyle || 'rail'),
        selectionMode: String(req.body?.selectionMode || 'auto'),
        placementKey: String(req.body?.placementKey || ''),
        categoryFilter: String(req.body?.categoryFilter || ''),
        languageFilter: String(req.body?.languageFilter || ''),
        contentTypeFilter: String(req.body?.contentTypeFilter || ''),
        requiredPackageSlug: String(req.body?.requiredPackageSlug || ''),
        viewAllLink: String(req.body?.viewAllLink || ''),
        showRecentlyAddedRibbon: Boolean(req.body?.showRecentlyAddedRibbon),
        maxItems: Number(req.body?.maxItems || 10),
        sortOrder: Number(req.body?.sortOrder || 0),
        isActive: req.body?.isActive !== false,
      })
      .returning();
    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'homepage_section.create',
      entityType: 'homepage_section',
      entityId: created.id,
      details: { title, sectionType: created.sectionType },
    });
    res.status(201).json({ section: { ...created, assignedItems: [] } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create section' });
  }
});

router.put('/homepage-sections/reorder', async (req, res) => {
  const orderedIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx
        .update(homepageSections)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(homepageSections.id, orderedIds[i]));
    }
  });
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.patch('/homepage-sections/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fields = [
    'title',
    'subtitle',
    'sectionType',
    'layoutStyle',
    'selectionMode',
    'placementKey',
    'categoryFilter',
    'languageFilter',
    'contentTypeFilter',
    'requiredPackageSlug',
    'viewAllLink',
    'showRecentlyAddedRibbon',
    'maxItems',
    'sortOrder',
    'isActive',
  ];
  for (const k of fields) {
    if (req.body?.[k] !== undefined) updates[k] = req.body[k];
  }
  const [updated] = await db
    .update(homepageSections)
    .set(updates)
    .where(eq(homepageSections.id, id))
    .returning();
  invalidateLayoutCaches();
  res.json({ section: updated });
});

router.get('/homepage-sections/:id/items', async (req, res) => {
  const sectionId = Number(req.params.id);
  const rows = await db
    .select()
    .from(homepageSectionItems)
    .where(eq(homepageSectionItems.sectionId, sectionId))
    .orderBy(asc(homepageSectionItems.sortOrder), asc(homepageSectionItems.id));
  res.json({ items: rows });
});

router.put('/homepage-sections/:id/items', async (req: AuthRequest, res) => {
  try {
    const sectionId = Number(req.params.id);
    const items: Array<{ contentId?: number | null; channelId?: number | null }> = Array.isArray(
      req.body?.items
    )
      ? req.body.items
      : [];

    const seen = new Set<string>();
    const deduped: Array<{ contentId: number | null; channelId: number | null }> = [];
    for (const item of items) {
      const contentId = item.contentId ? Number(item.contentId) : null;
      const channelId = item.channelId ? Number(item.channelId) : null;
      if (!contentId && !channelId) continue;
      const key = contentId ? `co:${contentId}` : `ch:${channelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push({ contentId, channelId });
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(homepageSectionItems).where(eq(homepageSectionItems.sectionId, sectionId));
      for (let i = 0; i < deduped.length; i += 1) {
        await tx.insert(homepageSectionItems).values({
          sectionId,
          contentId: deduped[i].contentId,
          channelId: deduped[i].channelId,
          sortOrder: i + 1,
        });
      }
    });

    invalidateLayoutCaches();
    const saved = await db
      .select()
      .from(homepageSectionItems)
      .where(eq(homepageSectionItems.sectionId, sectionId))
      .orderBy(asc(homepageSectionItems.sortOrder));
    res.json({ items: saved });
  } catch (err) {
    console.error('Update section items error:', err);
    res.status(500).json({ error: 'Failed to update section items' });
  }
});

router.delete('/homepage-sections/:id', async (req, res) => {
  await db.delete(homepageSections).where(eq(homepageSections.id, Number(req.params.id)));
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.get('/placements', async (_req, res) => {
  const [chRows, coRows] = await Promise.all([
    db.select().from(channelPlacements).orderBy(asc(channelPlacements.sortOrder), asc(channelPlacements.id)),
    db.select().from(contentPlacements).orderBy(asc(contentPlacements.sortOrder), asc(contentPlacements.id)),
  ]);
  res.json({ channelPlacements: chRows, contentPlacements: coRows });
});

router.put('/placements/:placementKey', async (req: AuthRequest, res) => {
  try {
    const placementKey = String(req.params.placementKey || '').trim();
    const targetType = req.body?.targetType === 'channel' ? 'channel' : 'content';
    const rawIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
    const orderedIds = Array.from(new Set(rawIds.filter((id) => Number.isFinite(id) && id > 0)));

    await db.transaction(async (tx) => {
      if (targetType === 'channel') {
        await tx.delete(channelPlacements).where(eq(channelPlacements.placementKey, placementKey));
        for (let i = 0; i < orderedIds.length; i += 1) {
          await tx.insert(channelPlacements).values({
            channelId: orderedIds[i],
            placementKey,
            sortOrder: i + 1,
          });
        }
        const allCh = await tx.select().from(channels);
        const selectedSet = new Set(orderedIds);
        for (const ch of allCh) {
          const cur = ch.placements || [];
          const has = cur.includes(placementKey);
          if (selectedSet.has(ch.id) && !has) {
            await tx.update(channels).set({ placements: [...cur, placementKey] }).where(eq(channels.id, ch.id));
          } else if (!selectedSet.has(ch.id) && has) {
            await tx
              .update(channels)
              .set({ placements: cur.filter((k) => k !== placementKey) })
              .where(eq(channels.id, ch.id));
          }
        }
      } else {
        await tx.delete(contentPlacements).where(eq(contentPlacements.placementKey, placementKey));
        for (let i = 0; i < orderedIds.length; i += 1) {
          await tx.insert(contentPlacements).values({
            contentId: orderedIds[i],
            placementKey,
            sortOrder: i + 1,
          });
        }
        const allCo = await tx.select().from(contents);
        const selectedSet = new Set(orderedIds);
        for (const co of allCo) {
          const cur = co.placements || [];
          const has = cur.includes(placementKey);
          if (selectedSet.has(co.id) && !has) {
            await tx.update(contents).set({ placements: [...cur, placementKey] }).where(eq(contents.id, co.id));
          } else if (!selectedSet.has(co.id) && has) {
            await tx
              .update(contents)
              .set({ placements: cur.filter((k) => k !== placementKey) })
              .where(eq(contents.id, co.id));
          }
        }
      }
    });

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'placement.update',
      entityType: targetType,
      entityId: placementKey,
      details: { count: orderedIds.length },
    });
    res.json({ ok: true, placementKey, targetType, orderedIds });
  } catch (err) {
    console.error('Update placement error:', err);
    res.status(500).json({ error: 'Failed to update placement assignments' });
  }
});

// ---------------------------------------------------------------------------
// 5B. CMS Page Management (site_pages)
// ---------------------------------------------------------------------------
router.get('/pages', async (_req, res) => {
  const rows = await db.select().from(sitePages).orderBy(asc(sitePages.sortOrder), asc(sitePages.id));
  res.json({ pages: rows });
});

router.post('/pages', async (req: AuthRequest, res) => {
  try {
    const parsed = sitePageSchema.safeParse({
      ...req.body,
      slug: slugify(req.body?.slug || req.body?.title || ''),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid page payload' });
    }
    const data = parsed.data;
    const pageKey = (data.pageKey || data.slug).replace(/-/g, '_');

    const [created] = await db
      .insert(sitePages)
      .values({
        pageKey,
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle,
        metaTitle: data.metaTitle || `${data.title} — VEXORA`,
        metaDescription: data.metaDescription,
        heroHeading: data.heroHeading || data.title,
        heroBody: data.heroBody,
        heroImageUrl: data.heroImageUrl,
        sectionsJson: data.sectionsJson,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder,
      })
      .returning();

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'site_page.create',
      entityType: 'site_page',
      entityId: created.id,
      details: { slug: created.slug, title: created.title },
    });
    res.status(201).json({ page: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Page slug or pageKey already exists' });
    res.status(500).json({ error: 'Failed to create page' });
  }
});

router.patch('/pages/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const fields = [
      'title',
      'subtitle',
      'metaTitle',
      'metaDescription',
      'heroHeading',
      'heroBody',
      'heroImageUrl',
      'sectionsJson',
      'isPublished',
      'sortOrder',
    ];
    for (const k of fields) {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    }
    if (req.body?.slug !== undefined) updates.slug = slugify(req.body.slug);

    const [updated] = await db.update(sitePages).set(updates).where(eq(sitePages.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Page not found' });

    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'site_page.update',
      entityType: 'site_page',
      entityId: id,
      details: { slug: updated.slug, title: updated.title },
    });
    res.json({ page: updated });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Duplicate page slug' });
    res.status(500).json({ error: 'Failed to update page' });
  }
});

router.delete('/pages/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(sitePages).where(eq(sitePages.id, id));
  invalidateLayoutCaches();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'site_page.delete',
    entityType: 'site_page',
    entityId: id,
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 5C. Navigation Menu Management (navigation_items)
// ---------------------------------------------------------------------------
router.get('/navigation', async (_req, res) => {
  const rows = await db
    .select()
    .from(navigationItems)
    .orderBy(asc(navigationItems.location), asc(navigationItems.sortOrder), asc(navigationItems.id));
  res.json({ items: rows });
});

router.post('/navigation', async (req: AuthRequest, res) => {
  try {
    const parsed = navigationItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid menu item' });
    }
    const [created] = await db
      .insert(navigationItems)
      .values({
        label: parsed.data.label,
        url: parsed.data.url,
        location: parsed.data.location,
        parentId: parsed.data.parentId ?? null,
        badgeText: parsed.data.badgeText,
        openInNewTab: parsed.data.openInNewTab,
        sortOrder: parsed.data.sortOrder,
        isVisible: parsed.data.isVisible,
      })
      .returning();
    invalidateLayoutCaches();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'navigation.create',
      entityType: 'navigation_item',
      entityId: created.id,
      details: { label: created.label, url: created.url, location: created.location },
    });
    res.status(201).json({ item: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create navigation item' });
  }
});

router.put('/navigation/reorder', async (req: AuthRequest, res) => {
  const orderedIds: number[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(Number) : [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx
        .update(navigationItems)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(navigationItems.id, orderedIds[i]));
    }
  });
  invalidateLayoutCaches();
  res.json({ ok: true });
});

router.patch('/navigation/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ['label', 'url', 'location', 'badgeText', 'openInNewTab', 'sortOrder', 'isVisible']) {
    if (req.body?.[k] !== undefined) updates[k] = req.body[k];
  }
  if (req.body?.parentId !== undefined) updates.parentId = req.body.parentId ? Number(req.body.parentId) : null;

  const [updated] = await db
    .update(navigationItems)
    .set(updates)
    .where(eq(navigationItems.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Navigation item not found' });

  invalidateLayoutCaches();
  res.json({ item: updated });
});

router.delete('/navigation/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.delete(navigationItems).where(eq(navigationItems.id, id));
  invalidateLayoutCaches();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'navigation.delete',
    entityType: 'navigation_item',
    entityId: id,
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 5D. Excel & CSV Content Import Center
// ---------------------------------------------------------------------------
router.get('/excel/status', async (_req, res) => {
  const exists = fs.existsSync(DEFAULT_EXCEL_PATH);
  const stats = exists ? fs.statSync(DEFAULT_EXCEL_PATH) : null;
  const logs = await db
    .select()
    .from(excelImportLogs)
    .orderBy(desc(excelImportLogs.createdAt))
    .limit(25);
  res.json({
    workspaceFile: {
      exists,
      filename: 'dataexcel.xlsx',
      sizeBytes: stats?.size || 0,
      modifiedAt: stats?.mtime.toISOString() || null,
    },
    logs,
  });
});

router.get('/excel/logs', async (_req, res) => {
  const logs = await db
    .select()
    .from(excelImportLogs)
    .orderBy(desc(excelImportLogs.createdAt))
    .limit(40);
  res.json({ logs });
});

router.get('/excel/template', async (_req, res) => {
  try {
    const buffer = await generateTemplateWorkbookBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="vexora-import-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Excel template' });
  }
});

router.post('/excel/import-workspace', async (req: AuthRequest, res) => {
  try {
    const overwriteExisting = Boolean(req.body?.overwriteExisting);
    const report = await importWorkspaceExcelFile({
      overwriteExisting,
      mode: 'workspace',
      actor: req.currentUser ?? null,
    });
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Workspace Excel import failed' });
  }
});

router.post('/excel/upload', excelMemoryUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an .xlsx or .csv file to import' });
    }
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (!['.xlsx', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Only .xlsx and .csv files are supported' });
    }
    const overwriteExisting = req.body?.overwriteExisting === 'true' || req.body?.overwriteExisting === true;
    const report = await importWorkbookBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mode: 'upload',
      overwriteExisting,
      actor: req.currentUser ?? null,
    });
    res.json({ report });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to parse and import spreadsheet' });
  }
});

// ---------------------------------------------------------------------------
// 6. Users, Subscriptions, Packages, Wallets, Payments, Transactions
// ---------------------------------------------------------------------------
router.get('/users', async (_req, res) => {
  const [userRows, walletRows, subRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db.select().from(wallets),
    db
      .select({ subscription: subscriptions, packageName: packages.name })
      .from(subscriptions)
      .innerJoin(packages, eq(subscriptions.packageId, packages.id))
      .where(eq(subscriptions.status, 'active')),
  ]);

  const walletByUser = new Map(walletRows.map((w) => [w.userId, w]));
  const subByUser = new Map(subRows.map((s) => [s.subscription.userId, s]));

  res.json({
    users: userRows.map((u) => ({
      id: u.id,
      uid: u.uid,
      email: u.email,
      phone: u.phone,
      fullName: u.fullName,
      role: u.role,
      roleId: u.roleId,
      emailVerified: u.emailVerified,
      trialUsed: u.trialUsed,
      status: u.status,
      createdAt: u.createdAt,
      walletBalanceCents: walletByUser.get(u.id)?.balanceCents ?? 0,
      activePlan: subByUser.get(u.id)?.packageName ?? null,
    })),
  });
});

router.post('/users', async (req: AuthRequest, res) => {
  try {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid user payload' });
    }
    const { fullName, email, phone, password, role, roleId, status, emailVerified } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = `admin_created_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const created = await db.transaction(async (tx) => {
      const [userRow] = await tx
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          phone: phone || null,
          passwordHash,
          fullName,
          role,
          roleId: roleId ?? null,
          status,
          emailVerified,
        })
        .returning();

      await tx.insert(wallets).values({ userId: userRow.id, balanceCents: 0, currency: 'USD' });
      return userRow;
    });

    await recordAuditLog({
      actor: req.currentUser,
      action: 'user.create',
      entityType: 'user',
      entityId: created.id,
      details: { email: created.email, role: created.role },
    });

    res.status(201).json({
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        phone: created.phone,
        fullName: created.fullName,
        role: created.role,
        roleId: created.roleId,
        emailVerified: created.emailVerified,
        trialUsed: created.trialUsed,
        status: created.status,
        createdAt: created.createdAt,
        walletBalanceCents: 0,
        activePlan: null,
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Email or phone already exists' });
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.fullName !== undefined) updates.fullName = String(req.body.fullName).trim();
  if (req.body?.role !== undefined) updates.role = String(req.body.role);
  if (req.body?.roleId !== undefined) updates.roleId = req.body.roleId ? Number(req.body.roleId) : null;
  if (req.body?.status !== undefined) updates.status = String(req.body.status);
  if (req.body?.emailVerified !== undefined) updates.emailVerified = Boolean(req.body.emailVerified);

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    details: updates,
  });
  res.json({ user: updated });
});

router.delete('/users/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (req.currentUser?.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own active administrator account' });
  }
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  await recordAuditLog({
    actor: req.currentUser,
    action: 'user.delete',
    entityType: 'user',
    entityId: id,
    details: { email: deleted.email },
  });
  res.json({ ok: true });
});

router.get('/packages', async (_req, res) => {
  const rows = await db.select().from(packages).orderBy(asc(packages.sortOrder));
  res.json({ packages: rows });
});

router.patch('/packages/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body?.name !== undefined) updates.name = String(req.body.name);
  if (req.body?.priceCents !== undefined) updates.priceCents = Math.max(0, Number(req.body.priceCents));
  if (req.body?.durationDays !== undefined) updates.durationDays = Math.max(1, Number(req.body.durationDays));
  if (req.body?.maxDevices !== undefined) updates.maxDevices = Math.max(1, Number(req.body.maxDevices));
  if (req.body?.maxQuality !== undefined) updates.maxQuality = String(req.body.maxQuality);
  if (req.body?.description !== undefined) updates.description = String(req.body.description);
  if (req.body?.features !== undefined) updates.features = req.body.features;
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

  const [updated] = await db.update(packages).set(updates).where(eq(packages.id, id)).returning();
  invalidateLayoutCaches();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'package.update',
    entityType: 'package',
    entityId: id,
    details: updates,
  });
  res.json({ package: updated });
});

router.get('/subscriptions', async (_req, res) => {
  const rows = await db
    .select({
      subscription: subscriptions,
      userEmail: users.email,
      userName: users.fullName,
      packageName: packages.name,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .innerJoin(packages, eq(subscriptions.packageId, packages.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(100);
  res.json({ subscriptions: rows });
});

router.post('/subscriptions/grant', async (req: AuthRequest, res) => {
  try {
    const result = await activateUserSubscription({
      userId: Number(req.body?.userId),
      packageId: Number(req.body?.packageId),
      paymentMethod: 'admin',
      performedByUserId: req.currentUser?.id,
    });
    await recordAuditLog({
      actor: req.currentUser,
      action: 'subscription.admin_grant',
      entityType: 'subscription',
      entityId: result.subscription.id,
      details: { userId: req.body?.userId, packageId: req.body?.packageId },
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BusinessError) return res.status(err.statusCode).json({ error: err.message });
    res.status(500).json({ error: 'Failed to grant subscription' });
  }
});

router.post('/subscriptions/:id/expire', async (req: AuthRequest, res) => {
  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'expired', expiresAt: new Date() })
    .where(eq(subscriptions.id, Number(req.params.id)))
    .returning();
  res.json({ subscription: updated });
});

router.get('/wallets', async (_req, res) => {
  const rows = await db
    .select({
      wallet: wallets,
      userEmail: users.email,
      userName: users.fullName,
      userPhone: users.phone,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .orderBy(desc(wallets.updatedAt));
  res.json({ wallets: rows });
});

router.post('/wallets/:userId/adjust', async (req: AuthRequest, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    const deltaCents = Number(req.body?.deltaCents);
    const description = String(req.body?.description || 'Administrator wallet adjustment');
    const referenceKey =
      typeof req.body?.referenceKey === 'string' && req.body.referenceKey.trim()
        ? req.body.referenceKey.trim()
        : `adm_adj_${targetUserId}_${crypto.randomUUID()}`;

    const result = await adjustWalletBalance({
      userId: targetUserId,
      deltaCents,
      type: deltaCents >= 0 ? 'admin_credit' : 'admin_debit',
      referenceKey,
      description,
      performedByUserId: req.currentUser!.id,
      actorEmail: req.currentUser!.email || 'admin',
      metadata: { reason: description },
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BusinessError) return res.status(err.statusCode).json({ error: err.message });
    res.status(500).json({ error: 'Wallet adjustment failed' });
  }
});

router.get('/transactions', async (_req, res) => {
  const rows = await db
    .select({
      tx: walletTransactions,
      userEmail: users.email,
      userName: users.fullName,
    })
    .from(walletTransactions)
    .innerJoin(users, eq(walletTransactions.userId, users.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(100);
  res.json({ transactions: rows });
});

router.get('/payments', async (_req, res) => {
  const rows = await db
    .select({
      payment: payments,
      userEmail: users.email,
      userName: users.fullName,
      packageName: packages.name,
    })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .leftJoin(packages, eq(payments.packageId, packages.id))
    .orderBy(desc(payments.createdAt))
    .limit(100);
  res.json({ payments: rows });
});

// ---------------------------------------------------------------------------
// 7. Notifications, Devices, Roles, Settings & Audit Logs
// ---------------------------------------------------------------------------
router.get('/notifications', async (_req, res) => {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
  res.json({ notifications: rows });
});

router.post('/notifications', async (req: AuthRequest, res) => {
  const [created] = await db
    .insert(notifications)
    .values({
      userId: req.body?.userId ? Number(req.body.userId) : null,
      title: String(req.body?.title || 'Platform Announcement'),
      message: String(req.body?.message || ''),
      type: String(req.body?.type || 'info'),
    })
    .returning();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'notification.send',
    entityType: 'notification',
    entityId: created.id,
  });
  res.status(201).json({ notification: created });
});

router.get('/devices', async (_req, res) => {
  const rows = await db
    .select({
      device: userDevices,
      userEmail: users.email,
      userName: users.fullName,
    })
    .from(userDevices)
    .innerJoin(users, eq(userDevices.userId, users.id))
    .orderBy(desc(userDevices.lastActiveAt))
    .limit(100);
  res.json({ devices: rows });
});

router.delete('/devices/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(userDevices)
    .set({ isRevoked: true })
    .where(eq(userDevices.id, id))
    .returning();
  await recordAuditLog({
    actor: req.currentUser,
    action: 'device.revoke',
    entityType: 'user_device',
    entityId: id,
  });
  res.json({ device: updated });
});

router.get('/roles', async (_req, res) => {
  const rows = await db.select().from(adminRoles).orderBy(asc(adminRoles.id));
  res.json({ roles: rows });
});

router.post('/roles', async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Role name is required' });
    const [created] = await db
      .insert(adminRoles)
      .values({
        name,
        slug: slugify(name),
        description: String(req.body?.description || ''),
        permissions: Array.isArray(req.body?.permissions) ? req.body.permissions : [],
      })
      .returning();
    await recordAuditLog({
      actor: req.currentUser,
      action: 'role.create',
      entityType: 'admin_role',
      entityId: created.id,
    });
    res.status(201).json({ role: created });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Role already exists' });
    res.status(500).json({ error: 'Failed to create role' });
  }
});

router.patch('/roles/:id', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(adminRoles)
    .set({
      name: req.body?.name,
      description: req.body?.description,
      permissions: req.body?.permissions,
    })
    .where(eq(adminRoles.id, id))
    .returning();
  res.json({ role: updated });
});

router.get('/settings', async (_req, res) => {
  const rows = await db.select().from(systemSettings).orderBy(asc(systemSettings.category), asc(systemSettings.key));
  res.json({ settings: rows });
});

router.put('/settings', async (req: AuthRequest, res) => {
  const items: Array<{ key: string; value: string; category?: string }> = Array.isArray(req.body?.settings)
    ? req.body.settings
    : [];
  for (const item of items) {
    await db
      .insert(systemSettings)
      .values({
        key: item.key,
        value: String(item.value ?? ''),
        category: item.category || 'general',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: String(item.value ?? ''), updatedAt: new Date() },
      });
  }
  appCache.invalidatePrefix('settings:');
  await recordAuditLog({
    actor: req.currentUser,
    action: 'settings.update',
    entityType: 'system_settings',
    details: { keys: items.map((i) => i.key) },
  });
  res.json({ ok: true });
});

router.get('/audit-logs', async (_req, res) => {
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  res.json({ logs: rows });
});

export default router;
