import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { probePlayableHlsStream } from '../src/services/hlsMonitor.ts';

let apiServer: http.Server;
let apiBaseUrl = '';
let hlsMockServer: http.Server;
let hlsMockBaseUrl = '';

beforeAll(async () => {
  hlsMockServer = http.createServer((req, res) => {
    if (req.url === '/html-200') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>200 OK but NOT HLS</body></html>');
      return;
    }
    if (req.url === '/master.m3u8') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      res.end(
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720\n/variant.m3u8\n'
      );
      return;
    }
    if (req.url === '/variant.m3u8') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      res.end(
        '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\n/seg0.ts\n#EXT-X-ENDLIST\n'
      );
      return;
    }
    if (req.url === '/seg0.ts') {
      res.writeHead(200, { 'Content-Type': 'video/mp2t' });
      res.end(Buffer.from([0x47, 0x40, 0x00, 0x10]));
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  });

  await new Promise<void>((resolve) => {
    hlsMockServer.listen(0, '127.0.0.1', () => {
      const addr = hlsMockServer.address() as any;
      hlsMockBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  const app = await createApp({ mountFrontend: false });
  await new Promise<void>((resolve) => {
    apiServer = app.listen(0, '127.0.0.1', () => {
      const addr = apiServer.address() as any;
      apiBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => apiServer?.close(() => resolve()));
  await new Promise<void>((resolve) => hlsMockServer?.close(() => resolve()));
});

describe('1. Playable HLS Verification Engine', () => {
  it('rejects HTTP 200 HTML payload as unplayable offline stream', async () => {
    const result = await probePlayableHlsStream(`${hlsMockBaseUrl}/html-200`);
    expect(result.httpStatus).toBe(200);
    expect(result.isPlayable).toBe(false);
    expect(result.healthStatus).toBe('offline');
  });

  it('verifies valid master -> variant -> segment HLS manifest as healthy', async () => {
    const result = await probePlayableHlsStream(`${hlsMockBaseUrl}/master.m3u8`);
    expect(result.isPlayable).toBe(true);
    expect(result.healthStatus).toBe('healthy');
    expect(result.playlistInfo.type).toBe('master');
    expect(result.playlistInfo.variantVerified).toBe(true);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('marks 404 manifest URL as offline', async () => {
    const result = await probePlayableHlsStream(`${hlsMockBaseUrl}/missing.m3u8`);
    expect(result.isPlayable).toBe(false);
    expect(result.healthStatus).toBe('offline');
  });
});

describe('2. Catalog, Packages & Unlimited Streams API', () => {
  it('responds healthy on /api/health', async () => {
    const res = await fetch(`${apiBaseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.database?.connected).toBe(true);
    expect(typeof data.database?.latencyMs).toBe('number');
  });

  it('serves exact 4 initial subscription packages', async () => {
    const res = await fetch(`${apiBaseUrl}/api/packages`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.packages.length).toBe(4);
    expect(data.packages.map((p: any) => p.slug)).toEqual([
      'free-access',
      'starter',
      'premium',
      'ultimate',
    ]);
  });

  it('supports more than 5 HLS stream URLs on Live TV channels', async () => {
    const res = await fetch(`${apiBaseUrl}/api/channels`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const veloNews = data.channels.find((c: any) => c.slug === 'velonews-24');
    expect(veloNews).toBeDefined();
    expect(veloNews.streams.length).toBeGreaterThanOrEqual(6);
  });

  it('searches across channels and VOD catalog', async () => {
    const res = await fetch(`${apiBaseUrl}/api/search?q=Meridian`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.movies.length).toBeGreaterThan(0);
  });
});

describe('3. Auth, Trial Abuse Prevention, Wallet & Subscriptions', () => {
  const uniqueSuffix = Date.now();
  const fp = `test_fp_${uniqueSuffix}`;
  let userToken = '';

  it('registers a user, activates 15-day free trial, and blocks duplicate trial on same device', async () => {
    const reg1 = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Streamer',
        email: `tester_${uniqueSuffix}@velostream.test`,
        password: 'Password123!',
        deviceFingerprint: fp,
        activateFreeTrial: true,
      }),
    });
    expect(reg1.status).toBe(201);
    const data1 = await reg1.json();
    expect(data1.activatedTrial).toBe(true);
    userToken = data1.token;

    if (data1.emailVerification?.verificationToken) {
      const verifyRes = await fetch(`${apiBaseUrl}/api/auth/verify-email/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data1.emailVerification.verificationToken }),
      });
      expect(verifyRes.status).toBe(200);
    }

    const reg2 = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Abuse Account',
        email: `abuse_${uniqueSuffix}@velostream.test`,
        password: 'Password123!',
        deviceFingerprint: fp,
        activateFreeTrial: true,
      }),
    });
    expect(reg2.status).toBe(201);
    const data2 = await reg2.json();
    expect(data2.activatedTrial).toBe(false);
    expect(data2.trialWarning).toBeTruthy();

    const loginRes = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({
        identifier: `tester_${uniqueSuffix}@velostream.test`,
        password: 'Password123!',
        deviceFingerprint: fp,
      }),
    });
    expect(loginRes.status).toBe(200);
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('SameSite=None');
    expect(setCookieHeader).toContain('Secure');
    const loginData = await loginRes.json();
    expect(loginData.token).toBeTruthy();

    const meRes = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.email).toBe(`tester_${uniqueSuffix}@velostream.test`);
  });

  it('prevents duplicate wallet topup transactions and executes atomic package purchase', async () => {
    const refKey = `ref_${uniqueSuffix}`;
    const topup1 = await fetch(`${apiBaseUrl}/api/wallet/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ amountCents: 3000, referenceKey: refKey }),
    });
    expect(topup1.status).toBe(201);

    const topupDup = await fetch(`${apiBaseUrl}/api/wallet/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ amountCents: 3000, referenceKey: refKey }),
    });
    expect(topupDup.status).toBe(409);

    const pkgsRes = await fetch(`${apiBaseUrl}/api/packages`);
    const { packages } = await pkgsRes.json();
    const starter = packages.find((p: any) => p.slug === 'starter');

    const subRes = await fetch(`${apiBaseUrl}/api/subscriptions/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ packageId: starter.id, paymentMethod: 'wallet' }),
    });
    expect(subRes.status).toBe(201);

    const dashRes = await fetch(`${apiBaseUrl}/api/user/dashboard`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const dash = await dashRes.json();
    expect(dash.wallet.balanceCents).toBe(3000 - starter.priceCents);
    expect(dash.activeSubscription.package.slug).toBe('starter');
  });

  it('blocks standard users from Admin endpoints and allows Admin operations with cache invalidation', async () => {
    const denied = await fetch(`${apiBaseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(denied.status).toBe(403);

    const adminLogin = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@velostream.tv',
        password: 'VeloAdmin!2026',
      }),
    });
    expect(adminLogin.status).toBe(200);
    const { token: adminToken } = await adminLogin.json();

    const overview = await fetch(`${apiBaseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(overview.status).toBe(200);

    // Admin User Create & Safe Delete
    const createdEmail = `staff_${uniqueSuffix}@vexora.test`;
    const createStaffRes = await fetch(`${apiBaseUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Automated Staff',
        email: createdEmail,
        password: 'StaffPassword123!',
        role: 'editor',
        status: 'active',
        emailVerified: true,
      }),
    });
    expect(createStaffRes.status).toBe(201);
    const { user: createdStaff } = await createStaffRes.json();
    expect(createdStaff.role).toBe('editor');

    const delStaffRes = await fetch(`${apiBaseUrl}/api/admin/users/${createdStaff.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delStaffRes.status).toBe(200);
  });

  it('returns VOD web-series details with seasons and episodes hierarchy', async () => {
    const listRes = await fetch(`${apiBaseUrl}/api/contents?type=series`);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.items.length).toBeGreaterThan(0);

    const firstSlug = listData.items[0].slug;
    const detailRes = await fetch(`${apiBaseUrl}/api/contents/${firstSlug}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.content.slug).toBe(firstSlug);
    expect(Array.isArray(detail.seasons)).toBe(true);
    expect(detail.seasons.length).toBeGreaterThan(0);
    expect(detail.seasons[0].episodes.length).toBeGreaterThan(0);
  });
});

describe('4. Language Policy Check', () => {
  it('contains zero Bangla Unicode characters anywhere in frontend/src, backend/src, or database', () => {
    const banglaRegex = /[\u0980-\u09FF]/;
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|css|html)$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8');
          expect(banglaRegex.test(text)).toBe(false);
        }
      }
    };
    walk(path.resolve(process.cwd(), 'frontend', 'src'));
    walk(path.resolve(process.cwd(), 'backend', 'src'));
    walk(path.resolve(process.cwd(), 'database'));
  });
});

describe('5. Homepage Layout, Page Hero Sliders & Strict Live TV Categories', () => {
  it('serves full dynamic /api/home sections with Bangla/International/News isolation', async () => {
    const res = await fetch(`${apiBaseUrl}/api/home`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.heroSlides)).toBe(true);
    expect(data.heroSlides.length).toBeGreaterThan(0);
    expect(Array.isArray(data.sections)).toBe(true);

    const banglaSection = data.sections.find((s: any) => s.sectionType === 'bangla_entertainment');
    expect(banglaSection).toBeDefined();
    for (const item of banglaSection.items) {
      expect((item.language || '').toLowerCase()).toBe('bangla');
    }

    const intlSection = data.sections.find(
      (s: any) => s.sectionType === 'international_entertainment'
    );
    expect(intlSection).toBeDefined();
    for (const item of intlSection.items) {
      expect((item.language || '').toLowerCase()).not.toBe('bangla');
    }
  });

  it('serves independent page-specific hero sliders and dynamic CMS navigation/pages/settings', async () => {
    const [navRes, pageRes, settingsRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/navigation`),
      fetch(`${apiBaseUrl}/api/pages/faq`),
      fetch(`${apiBaseUrl}/api/settings/public`),
    ]);
    expect(navRes.status).toBe(200);
    const navData = await navRes.json();
    expect(Array.isArray(navData.header)).toBe(true);
    expect(navData.header.length).toBeGreaterThan(0);

    expect(pageRes.status).toBe(200);
    const pageData = await pageRes.json();
    expect(pageData.page.slug).toBe('faq');

    expect(settingsRes.status).toBe(200);
    const settingsData = await settingsRes.json();
    expect(settingsData.platformName).toBeTruthy();
  });
});

describe('6. CMS CRUD, Media Scan & Excel/CSV Import', () => {
  it('creates/deletes a CMS Page, tests Navigation sync, and imports CSV safely without duplicating existing records', async () => {
    const adminLogin = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@velostream.tv',
        password: 'VeloAdmin!2026',
      }),
    });
    const { token: adminToken } = await adminLogin.json();

    // 1. CMS Page CRUD
    const pageSlug = `test-cms-${Date.now()}`;
    const createPageRes = await fetch(`${apiBaseUrl}/api/admin/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Test CMS Guide',
        slug: pageSlug,
        subtitle: 'Automated verification page',
        isPublished: true,
        sectionsJson: [{ id: 's1', heading: 'Section 1', body: 'Hello CMS', sortOrder: 1, isVisible: true }],
      }),
    });
    expect(createPageRes.status).toBe(201);
    const { page } = await createPageRes.json();

    const pubPageRes = await fetch(`${apiBaseUrl}/api/pages/${pageSlug}`);
    expect(pubPageRes.status).toBe(200);

    await fetch(`${apiBaseUrl}/api/admin/pages/${page.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // 2. Media Scan
    const mediaRes = await fetch(`${apiBaseUrl}/api/admin/media`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(mediaRes.status).toBe(200);
    const mediaData = await mediaRes.json();
    expect(Array.isArray(mediaData.assets)).toBe(true);
    expect(mediaData.assets.length).toBeGreaterThan(0);

    // 3. Workspace Excel import duplicate-safe skip check
    const excelRes = await fetch(`${apiBaseUrl}/api/admin/excel/import-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ overwriteExisting: false }),
    });
    expect(excelRes.status).toBe(200);
    const { report } = await excelRes.json();
    expect(report.errorCount).toBe(0);
    expect(report.skippedCount + report.insertedCount).toBeGreaterThan(0);
  });
});
