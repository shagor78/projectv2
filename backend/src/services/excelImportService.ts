import ExcelJS from 'exceljs';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../../../database/index.ts';
import {
  channelCategories,
  channelCategoryAssignments,
  channelPlacements,
  channels,
  channelStreams,
  contentCategories,
  contentCategoryAssignments,
  contentPlacements,
  contents,
  excelImportLogs,
  navigationItems,
  sitePages,
  systemSettings,
} from '../../../database/schema/index.ts';
import { DEFAULT_EXCEL_PATH } from '../config/env.ts';
import { type AuthenticatedUser, recordAuditLog } from '../middleware/auth.ts';
import { normalizeStringList, slugify } from '../utils/slugify.ts';
import { invalidatePublicCatalogCaches } from './cache.ts';

export interface ImportRowIssue {
  sheet: string;
  row: number;
  identifier: string;
  action: 'inserted' | 'updated' | 'skipped' | 'error';
  message: string;
}

export interface ExcelImportReport {
  filename: string;
  mode: 'workspace' | 'upload' | 'seed';
  overwriteExisting: boolean;
  sheetsProcessed: string[];
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  perSheet: Record<
    string,
    { inserted: number; updated: number; skipped: number; errors: number }
  >;
  details: ImportRowIssue[];
}

function parseBool(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (['true', '1', 'yes', 'y', 'published', 'active'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'draft', 'hidden', 'inactive'].includes(s)) return false;
  return fallback;
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const obj = val as Record<string, any>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.result !== 'undefined') return String(obj.result).trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r: any) => r.text || '').join('').trim();
    }
    if (typeof obj.hyperlink === 'string') return obj.hyperlink.trim();
  }
  return String(val).trim();
}

function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const clean = csvText.replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

function sheetToObjects(worksheet: ExcelJS.Worksheet): Array<{ rowNumber: number; data: Record<string, string> }> {
  const results: Array<{ rowNumber: number; data: Record<string, string> }> = [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellToString(cell.value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_|_$)/g, '');
  });

  if (headers.filter(Boolean).length === 0) return results;

  for (let r = 2; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const data: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, idx) => {
      if (!h) return;
      const val = cellToString(row.getCell(idx).value);
      if (val) hasValue = true;
      data[h] = val;
    });
    if (hasValue) {
      results.push({ rowNumber: r, data });
    }
  }
  return results;
}

function normalizeSheetType(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('livechannel') || clean === 'channels') return 'channels';
  if (clean === 'movies' || clean === 'movie') return 'movies';
  if (clean === 'drama' || clean === 'dramas') return 'drama';
  if (clean === 'webseries' || clean === 'series') return 'series';
  if (clean === 'sports' || clean === 'sport') return 'sports';
  if (clean === 'contentcategories' || clean === 'categories') return 'content_categories';
  if (clean === 'channelcategories') return 'channel_categories';
  if (clean === 'navigation' || clean === 'menus') return 'navigation';
  if (clean === 'pages' || clean === 'cms') return 'pages';
  if (clean === 'settings') return 'settings';
  return 'vod';
}

export async function importWorkbookBuffer(params: {
  buffer: Buffer;
  filename: string;
  mode: 'workspace' | 'upload' | 'seed';
  overwriteExisting?: boolean;
  actor?: AuthenticatedUser | null;
}): Promise<ExcelImportReport> {
  const overwrite = Boolean(params.overwriteExisting);
  const lowerName = params.filename.toLowerCase();
  const isCsv = lowerName.endsWith('.csv');

  const sheetsData: Array<{ sheetName: string; sheetKind: string; rows: Array<{ rowNumber: number; data: Record<string, string> }> }> = [];

  if (isCsv) {
    const matrix = parseCsvMatrix(params.buffer.toString('utf8'));
    if (matrix.length < 2) {
      throw new Error('CSV file must include a header row and at least one data row');
    }
    const headers = matrix[0].map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
    );
    const rows = matrix.slice(1).map((cols, idx) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) data[h] = (cols[i] || '').trim();
      });
      return { rowNumber: idx + 2, data };
    });
    const isChannelCsv = headers.includes('channel_number') || headers.includes('stream_url');
    sheetsData.push({
      sheetName: isChannelCsv ? 'LiveChannels' : 'VOD',
      sheetKind: isChannelCsv ? 'channels' : 'vod',
      rows,
    });
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(params.buffer as any);
    for (const ws of workbook.worksheets) {
      const rows = sheetToObjects(ws);
      if (rows.length > 0) {
        sheetsData.push({
          sheetName: ws.name,
          sheetKind: normalizeSheetType(ws.name),
          rows,
        });
      }
    }
  }

  if (sheetsData.length === 0) {
    throw new Error('No populated worksheets or rows found in file');
  }

  const report: ExcelImportReport = {
    filename: params.filename,
    mode: params.mode,
    overwriteExisting: overwrite,
    sheetsProcessed: sheetsData.map((s) => s.sheetName),
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    perSheet: {},
    details: [],
  };

  const recordOutcome = (
    sheet: string,
    row: number,
    identifier: string,
    action: ImportRowIssue['action'],
    message: string
  ) => {
    if (!report.perSheet[sheet]) {
      report.perSheet[sheet] = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    }
    if (action === 'inserted') {
      report.insertedCount += 1;
      report.perSheet[sheet].inserted += 1;
    } else if (action === 'updated') {
      report.updatedCount += 1;
      report.perSheet[sheet].updated += 1;
    } else if (action === 'skipped') {
      report.skippedCount += 1;
      report.perSheet[sheet].skipped += 1;
    } else {
      report.errorCount += 1;
      report.perSheet[sheet].errors += 1;
    }
    report.details.push({ sheet, row, identifier, action, message });
  };

  // Preload category caches
  const existingChannelCats = await db.select().from(channelCategories);
  const channelCatBySlug = new Map(existingChannelCats.map((c) => [c.slug, c.id]));

  const existingContentCats = await db.select().from(contentCategories);
  const contentCatBySlug = new Map(existingContentCats.map((c) => [c.slug, c.id]));

  const ensureChannelCat = async (catName: string): Promise<number> => {
    const slug = slugify(catName);
    const existing = channelCatBySlug.get(slug);
    if (existing) return existing;
    const [created] = await db
      .insert(channelCategories)
      .values({ name: catName.trim(), slug, isActive: true, language: 'All', categoryType: 'general' })
      .returning();
    channelCatBySlug.set(slug, created.id);
    return created.id;
  };

  const ensureContentCat = async (catName: string, contentType: string): Promise<number> => {
    const slug = slugify(catName);
    const existing = contentCatBySlug.get(slug);
    if (existing) return existing;
    const [created] = await db
      .insert(contentCategories)
      .values({ name: catName.trim(), slug, contentType, isActive: true })
      .returning();
    contentCatBySlug.set(slug, created.id);
    return created.id;
  };

  for (const sheet of sheetsData) {
    if (!report.perSheet[sheet.sheetName]) {
      report.perSheet[sheet.sheetName] = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    }

    for (const entry of sheet.rows) {
      const { rowNumber, data } = entry;
      try {
        if (sheet.sheetKind === 'channels') {
          const name = data.name || data.channel_name || data.title || '';
          if (!name) {
            recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Missing channel name');
            continue;
          }
          const slug = slugify(data.slug || name);
          const channelNumber = Number(data.channel_number || 200);
          const streamUrl = data.stream_url || data.hls_url || '';
          const backupStreamUrl = data.backup_stream_url || '';
          if (!streamUrl) {
            recordOutcome(sheet.sheetName, rowNumber, name, 'error', 'Missing primary stream_url');
            continue;
          }

          const [existing] = await db.select().from(channels).where(eq(channels.slug, slug));
          if (existing && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, slug, 'skipped', 'Channel already exists (overwrite=false)');
            continue;
          }

          const placements = normalizeStringList(data.placements || 'homepage_live');
          const catNames = normalizeStringList(data.categories || data.category || 'Entertainment');

          let channelId: number;
          if (existing) {
            const [updated] = await db
              .update(channels)
              .set({
                name,
                channelNumber: Number.isFinite(channelNumber) ? channelNumber : existing.channelNumber,
                logoUrl: data.logo_url || existing.logoUrl,
                description: data.description || existing.description,
                country: data.country || existing.country,
                language: data.language || existing.language,
                isFeatured: data.is_featured ? parseBool(data.is_featured) : existing.isFeatured,
                isPublished: data.is_published ? parseBool(data.is_published, true) : existing.isPublished,
                placements: placements.length ? placements : existing.placements,
                updatedAt: new Date(),
              })
              .where(eq(channels.id, existing.id))
              .returning();
            channelId = updated.id;
            recordOutcome(sheet.sheetName, rowNumber, slug, 'updated', `Updated channel ${name}`);
          } else {
            const [created] = await db
              .insert(channels)
              .values({
                name,
                slug,
                channelNumber: Number.isFinite(channelNumber) ? channelNumber : 200,
                logoUrl: data.logo_url || '',
                description: data.description || '',
                country: data.country || 'International',
                language: data.language || 'English',
                isFeatured: parseBool(data.is_featured, false),
                isPublished: parseBool(data.is_published, true),
                showOnHomepage: parseBool(data.show_on_homepage, true),
                showOnLiveTv: parseBool(data.show_on_live_tv, true),
                sortOrder: Number(data.sort_order || 50),
                placements,
                currentHealthStatus: 'unknown',
              })
              .returning();
            channelId = created.id;

            await db.insert(channelStreams).values({
              channelId,
              label: data.stream_label || 'Primary HLS Edge',
              streamUrl,
              priority: 1,
              isActive: true,
            });
            if (backupStreamUrl) {
              await db.insert(channelStreams).values({
                channelId,
                label: 'Secondary Failover Edge',
                streamUrl: backupStreamUrl,
                priority: 2,
                isActive: true,
              });
            }
            recordOutcome(sheet.sheetName, rowNumber, slug, 'inserted', `Inserted channel ${name}`);
          }

          for (const catName of catNames) {
            const catId = await ensureChannelCat(catName);
            await db
              .insert(channelCategoryAssignments)
              .values({ channelId, categoryId: catId })
              .onConflictDoNothing();
          }
          for (let idx = 0; idx < placements.length; idx += 1) {
            await db
              .insert(channelPlacements)
              .values({ channelId, placementKey: placements[idx], sortOrder: idx + 1 })
              .onConflictDoNothing();
          }
          continue;
        }

        if (sheet.sheetKind === 'navigation') {
          const label = data.label || '';
          const url = data.url || '';
          if (!label || !url) {
            recordOutcome(sheet.sheetName, rowNumber, label || '(blank)', 'error', 'Navigation label and url required');
            continue;
          }
          const location = ['header', 'footer', 'footer_membership'].includes(data.location)
            ? data.location
            : 'header';
          const existingAll = await db.select().from(navigationItems);
          const dup = existingAll.find((n) => n.location === location && n.url === url);
          if (dup && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, `${location}:${url}`, 'skipped', 'Navigation link already exists');
            continue;
          }
          if (dup) {
            await db
              .update(navigationItems)
              .set({
                label,
                badgeText: data.badge_text || '',
                sortOrder: Number(data.sort_order || dup.sortOrder),
                isVisible: parseBool(data.is_visible, true),
                updatedAt: new Date(),
              })
              .where(eq(navigationItems.id, dup.id));
            recordOutcome(sheet.sheetName, rowNumber, `${location}:${url}`, 'updated', `Updated menu item ${label}`);
          } else {
            await db.insert(navigationItems).values({
              label,
              url,
              location,
              badgeText: data.badge_text || '',
              sortOrder: Number(data.sort_order || 10),
              isVisible: parseBool(data.is_visible, true),
            });
            recordOutcome(sheet.sheetName, rowNumber, `${location}:${url}`, 'inserted', `Inserted menu item ${label}`);
          }
          continue;
        }

        if (sheet.sheetKind === 'pages') {
          const title = data.title || '';
          const slug = slugify(data.slug || data.page_key || title);
          const pageKey = (data.page_key || slug).replace(/-/g, '_');
          if (!title || !slug) {
            recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Page title and slug required');
            continue;
          }
          const [existing] = await db.select().from(sitePages).where(eq(sitePages.slug, slug));
          if (existing && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, slug, 'skipped', 'Page already exists');
            continue;
          }
          const sectionsJson = data.section_heading
            ? [
                {
                  id: `${slug}-sec-1`,
                  heading: data.section_heading,
                  body: data.section_body || '',
                  ctaLabel: data.cta_label || '',
                  ctaUrl: data.cta_url || '',
                  sortOrder: 1,
                  isVisible: true,
                },
              ]
            : existing?.sectionsJson || [];

          if (existing) {
            await db
              .update(sitePages)
              .set({
                title,
                subtitle: data.subtitle || existing.subtitle,
                metaTitle: data.meta_title || existing.metaTitle,
                metaDescription: data.meta_description || existing.metaDescription,
                heroHeading: data.hero_heading || existing.heroHeading,
                heroBody: data.hero_body || existing.heroBody,
                heroImageUrl: data.hero_image_url || existing.heroImageUrl,
                sectionsJson,
                isPublished: parseBool(data.is_published, true),
                updatedAt: new Date(),
              })
              .where(eq(sitePages.id, existing.id));
            recordOutcome(sheet.sheetName, rowNumber, slug, 'updated', `Updated page ${title}`);
          } else {
            await db.insert(sitePages).values({
              pageKey,
              slug,
              title,
              subtitle: data.subtitle || '',
              metaTitle: data.meta_title || `${title} — VEXORA`,
              metaDescription: data.meta_description || '',
              heroHeading: data.hero_heading || title,
              heroBody: data.hero_body || data.subtitle || '',
              heroImageUrl: data.hero_image_url || '',
              sectionsJson,
              isPublished: parseBool(data.is_published, true),
              sortOrder: Number(data.sort_order || 20),
            });
            recordOutcome(sheet.sheetName, rowNumber, slug, 'inserted', `Inserted page ${title}`);
          }
          continue;
        }

        if (sheet.sheetKind === 'settings') {
          const key = data.key || '';
          const value = data.value ?? '';
          if (!key) {
            recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Setting key required');
            continue;
          }
          const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
          if (existing && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, key, 'skipped', 'Setting already exists');
            continue;
          }
          await db
            .insert(systemSettings)
            .values({
              key,
              value,
              category: data.category || 'general',
              description: data.description || '',
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: systemSettings.key,
              set: { value, updatedAt: new Date() },
            });
          recordOutcome(sheet.sheetName, rowNumber, key, existing ? 'updated' : 'inserted', `Saved setting ${key}`);
          continue;
        }

        if (sheet.sheetKind === 'content_categories') {
          const name = data.name || '';
          if (!name) {
            recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Category name required');
            continue;
          }
          const slug = slugify(data.slug || name);
          const existing = contentCatBySlug.get(slug);
          if (existing && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, slug, 'skipped', 'Content category exists');
            continue;
          }
          if (existing) {
            await db
              .update(contentCategories)
              .set({
                name,
                description: data.description || '',
                contentType: data.content_type || 'all',
                language: data.language || 'All',
              })
              .where(eq(contentCategories.id, existing));
            recordOutcome(sheet.sheetName, rowNumber, slug, 'updated', `Updated category ${name}`);
          } else {
            const [created] = await db
              .insert(contentCategories)
              .values({
                name,
                slug,
                description: data.description || '',
                contentType: data.content_type || 'all',
                language: data.language || 'All',
                sortOrder: Number(data.sort_order || 20),
                isActive: true,
              })
              .returning();
            contentCatBySlug.set(slug, created.id);
            recordOutcome(sheet.sheetName, rowNumber, slug, 'inserted', `Inserted category ${name}`);
          }
          continue;
        }

        if (sheet.sheetKind === 'channel_categories') {
          const name = data.name || '';
          if (!name) {
            recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Category name required');
            continue;
          }
          const slug = slugify(data.slug || name);
          const existing = channelCatBySlug.get(slug);
          if (existing && !overwrite) {
            recordOutcome(sheet.sheetName, rowNumber, slug, 'skipped', 'Channel category exists');
            continue;
          }
          if (existing) {
            await db
              .update(channelCategories)
              .set({
                name,
                description: data.description || '',
                language: data.language || 'All',
                categoryType: data.category_type || 'general',
              })
              .where(eq(channelCategories.id, existing));
            recordOutcome(sheet.sheetName, rowNumber, slug, 'updated', `Updated category ${name}`);
          } else {
            const [created] = await db
              .insert(channelCategories)
              .values({
                name,
                slug,
                description: data.description || '',
                language: data.language || 'All',
                categoryType: data.category_type || 'general',
                sortOrder: Number(data.sort_order || 20),
                isActive: true,
              })
              .returning();
            channelCatBySlug.set(slug, created.id);
            recordOutcome(sheet.sheetName, rowNumber, slug, 'inserted', `Inserted category ${name}`);
          }
          continue;
        }

        // Default VOD sheets: Movies, Drama, WebSeries, Sports, or generic VOD CSV
        const title = data.title || data.name || '';
        if (!title) {
          recordOutcome(sheet.sheetName, rowNumber, '(blank)', 'error', 'Missing content title');
          continue;
        }

        const inferredType =
          sheet.sheetKind === 'movies'
            ? 'movie'
            : sheet.sheetKind === 'drama'
            ? 'drama'
            : sheet.sheetKind === 'series'
            ? 'series'
            : sheet.sheetKind === 'sports'
            ? 'sports'
            : (data.content_type || 'movie').toLowerCase();

        if (!['movie', 'drama', 'series', 'sports'].includes(inferredType)) {
          recordOutcome(
            sheet.sheetName,
            rowNumber,
            title,
            'error',
            `Invalid content_type "${inferredType}". Must be movie, drama, series, or sports.`
          );
          continue;
        }

        const slug = slugify(data.slug || title);
        const [existing] = await db.select().from(contents).where(eq(contents.slug, slug));
        if (existing && !overwrite) {
          recordOutcome(sheet.sheetName, rowNumber, slug, 'skipped', 'Content slug already exists (overwrite=false)');
          continue;
        }

        const tags = normalizeStringList(data.tags || '');
        const castList = normalizeStringList(data.cast || data.cast_list || '');
        const placements = normalizeStringList(data.placements || 'recently_added');
        const catNames = normalizeStringList(data.categories || data.category || '');
        const releaseYear = Number(data.release_year || (data.release_date || '2026').slice(0, 4) || 2026);

        let contentId: number;
        if (existing) {
          const [updated] = await db
            .update(contents)
            .set({
              title,
              contentType: inferredType,
              synopsis: data.synopsis || existing.synopsis,
              posterUrl: data.poster_url || existing.posterUrl,
              backdropUrl: data.backdrop_url || existing.backdropUrl,
              hlsUrl: data.hls_url || existing.hlsUrl,
              trailerUrl: data.trailer_url || existing.trailerUrl,
              releaseDate: data.release_date || existing.releaseDate,
              releaseYear: Number.isFinite(releaseYear) ? releaseYear : existing.releaseYear,
              durationMinutes: Number(data.duration_minutes || existing.durationMinutes),
              rating: data.rating || existing.rating,
              maturityScore: data.maturity_score || existing.maturityScore,
              language: data.language || existing.language,
              country: data.country || existing.country,
              director: data.director || existing.director,
              castList: castList.length ? castList : existing.castList,
              tags: tags.length ? tags : existing.tags,
              isFeatured: data.is_featured ? parseBool(data.is_featured) : existing.isFeatured,
              isRecentlyAdded: data.is_recently_added ? parseBool(data.is_recently_added, true) : existing.isRecentlyAdded,
              isPublished: data.is_published ? parseBool(data.is_published, true) : existing.isPublished,
              requiresSubscription: data.requires_subscription
                ? parseBool(data.requires_subscription)
                : existing.requiresSubscription,
              placements: placements.length ? placements : existing.placements,
              updatedAt: new Date(),
            })
            .where(eq(contents.id, existing.id))
            .returning();
          contentId = updated.id;
          recordOutcome(sheet.sheetName, rowNumber, slug, 'updated', `Updated ${inferredType}: ${title}`);
        } else {
          const [created] = await db
            .insert(contents)
            .values({
              title,
              slug,
              contentType: inferredType,
              synopsis: data.synopsis || `${title} streaming on VEXORA.`,
              posterUrl: data.poster_url || '/src/assets/images/poster_midnight_meridian_1794748095273.jpg',
              backdropUrl: data.backdrop_url || data.poster_url || '/src/assets/images/hero_midnight_meridian_1794748093840.jpg',
              hlsUrl: data.hls_url || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
              trailerUrl: data.trailer_url || '',
              releaseDate: data.release_date || '2026-11-10',
              releaseYear: Number.isFinite(releaseYear) ? releaseYear : 2026,
              durationMinutes: Number(data.duration_minutes || 95),
              rating: data.rating || 'PG-13',
              maturityScore: data.maturity_score || '8.4',
              language: data.language || 'English',
              country: data.country || 'International',
              director: data.director || 'VEXORA Studios',
              castList,
              tags,
              isFeatured: parseBool(data.is_featured, false),
              isRecentlyAdded: parseBool(data.is_recently_added, true),
              isPublished: parseBool(data.is_published, true),
              requiresSubscription: parseBool(data.requires_subscription, false),
              placements,
              sortOrder: Number(data.sort_order || 50),
            })
            .returning();
          contentId = created.id;
          recordOutcome(sheet.sheetName, rowNumber, slug, 'inserted', `Inserted ${inferredType}: ${title}`);
        }

        for (const catName of catNames) {
          const catId = await ensureContentCat(catName, inferredType);
          await db
            .insert(contentCategoryAssignments)
            .values({ contentId, categoryId: catId })
            .onConflictDoNothing();
        }
        for (let idx = 0; idx < placements.length; idx += 1) {
          await db
            .insert(contentPlacements)
            .values({ contentId, placementKey: placements[idx], sortOrder: idx + 1 })
            .onConflictDoNothing();
        }
      } catch (err: any) {
        recordOutcome(
          sheet.sheetName,
          rowNumber,
          data.title || data.name || data.slug || `Row ${rowNumber}`,
          'error',
          err?.message || 'Unexpected row import failure'
        );
      }
    }
  }

  invalidatePublicCatalogCaches();

  await db.insert(excelImportLogs).values({
    filename: params.filename,
    mode: params.mode,
    overwriteExisting: overwrite,
    sheetsProcessed: report.sheetsProcessed,
    insertedCount: report.insertedCount,
    updatedCount: report.updatedCount,
    skippedCount: report.skippedCount,
    errorCount: report.errorCount,
    reportJson: {
      perSheet: report.perSheet,
      details: report.details.slice(0, 100),
    },
    importedByUserId: params.actor?.id ?? null,
  });

  if (params.actor) {
    await recordAuditLog({
      actor: params.actor,
      action: 'excel.import',
      entityType: 'excel_import',
      entityId: params.filename,
      details: {
        mode: params.mode,
        overwriteExisting: overwrite,
        inserted: report.insertedCount,
        updated: report.updatedCount,
        skipped: report.skippedCount,
        errors: report.errorCount,
      },
    });
  }

  return report;
}

export async function importWorkspaceExcelFile(params?: {
  overwriteExisting?: boolean;
  mode?: 'workspace' | 'seed';
  actor?: AuthenticatedUser | null;
}): Promise<ExcelImportReport> {
  if (!fs.existsSync(DEFAULT_EXCEL_PATH)) {
    throw new Error(`Workspace Excel file not found at ${DEFAULT_EXCEL_PATH}`);
  }
  const buffer = fs.readFileSync(DEFAULT_EXCEL_PATH);
  return importWorkbookBuffer({
    buffer,
    filename: 'dataexcel.xlsx',
    mode: params?.mode || 'workspace',
    overwriteExisting: params?.overwriteExisting ?? false,
    actor: params?.actor ?? null,
  });
}

export async function generateTemplateWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VEXORA CMS';

  const vodCols = [
    { header: 'title', key: 'title', width: 28 },
    { header: 'slug', key: 'slug', width: 26 },
    { header: 'language', key: 'language', width: 14 },
    { header: 'country', key: 'country', width: 16 },
    { header: 'director', key: 'director', width: 20 },
    { header: 'release_date', key: 'release_date', width: 14 },
    { header: 'duration_minutes', key: 'duration_minutes', width: 16 },
    { header: 'rating', key: 'rating', width: 10 },
    { header: 'maturity_score', key: 'maturity_score', width: 14 },
    { header: 'categories', key: 'categories', width: 26 },
    { header: 'tags', key: 'tags', width: 26 },
    { header: 'placements', key: 'placements', width: 24 },
    { header: 'poster_url', key: 'poster_url', width: 42 },
    { header: 'backdrop_url', key: 'backdrop_url', width: 42 },
    { header: 'hls_url', key: 'hls_url', width: 46 },
    { header: 'synopsis', key: 'synopsis', width: 48 },
    { header: 'is_featured', key: 'is_featured', width: 12 },
    { header: 'is_recently_added', key: 'is_recently_added', width: 16 },
    { header: 'is_published', key: 'is_published', width: 14 },
  ];

  const moviesWs = wb.addWorksheet('Movies');
  moviesWs.columns = vodCols;
  moviesWs.addRow({
    title: 'Sample Cinema Title',
    slug: 'sample-cinema-title',
    language: 'English',
    country: 'United Kingdom',
    director: 'Claire Vance',
    release_date: '2026-11-20',
    duration_minutes: 118,
    rating: 'PG-13',
    maturity_score: '8.7',
    categories: 'Action & Thriller, Sci-Fi & Mystery',
    tags: '4K, HDR, Thriller',
    placements: 'trending, recently_added',
    poster_url: '/src/assets/images/poster_midnight_meridian_1794748095273.jpg',
    backdrop_url: '/src/assets/images/hero_midnight_meridian_1794748093840.jpg',
    hls_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    synopsis: 'Replace this sample row with your movie catalog entry.',
    is_featured: true,
    is_recently_added: true,
    is_published: true,
  });

  const chWs = wb.addWorksheet('LiveChannels');
  chWs.columns = [
    { header: 'name', key: 'name', width: 24 },
    { header: 'slug', key: 'slug', width: 24 },
    { header: 'channel_number', key: 'channel_number', width: 16 },
    { header: 'language', key: 'language', width: 14 },
    { header: 'country', key: 'country', width: 16 },
    { header: 'categories', key: 'categories', width: 28 },
    { header: 'placements', key: 'placements', width: 26 },
    { header: 'stream_url', key: 'stream_url', width: 48 },
    { header: 'backup_stream_url', key: 'backup_stream_url', width: 48 },
    { header: 'description', key: 'description', width: 40 },
    { header: 'is_featured', key: 'is_featured', width: 12 },
    { header: 'is_published', key: 'is_published', width: 12 },
  ];
  chWs.addRow({
    name: 'Sample Sports Network',
    slug: 'sample-sports-network',
    channel_number: 225,
    language: 'English',
    country: 'Global',
    categories: 'Sports Channels, English Channels',
    placements: 'homepage_live, popular_channels',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    backup_stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    description: '24/7 sports broadcast desk with multi-source HLS failover.',
    is_featured: true,
    is_published: true,
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
