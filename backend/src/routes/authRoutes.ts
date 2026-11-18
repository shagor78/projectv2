import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../database/index.ts';
import {
  emailVerifications,
  notifications,
  packages,
  passwordResets,
  subscriptions,
  userDevices,
  users,
} from '../../../database/schema/index.ts';
import { adminAuth, firebaseConfig } from '../config/firebaseAdmin.ts';
import {
  type AuthRequest,
  requireAuth,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from '../middleware/auth.ts';
import { activateUserSubscription, ensureUserWallet } from '../services/walletAndSub.ts';

const router = Router();

function getSessionCookieOptions(req: Request) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const isHttps = req.secure || forwardedProto === 'https';
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
  };
}

function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function upsertUserDevice(params: {
  userId: number;
  deviceIdentifier?: string;
  deviceName?: string;
  platform?: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const devId =
    params.deviceIdentifier?.trim() ||
    crypto
      .createHash('sha256')
      .update(`${params.userAgent || 'browser'}_${params.platform || 'Web'}`)
      .digest('hex')
      .slice(0, 24);

  const [existing] = await db
    .select()
    .from(userDevices)
    .where(and(eq(userDevices.userId, params.userId), eq(userDevices.deviceIdentifier, devId)));

  if (existing && existing.isRevoked) {
    const [restored] = await db
      .update(userDevices)
      .set({
        isRevoked: false,
        lastActiveAt: new Date(),
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
      })
      .where(eq(userDevices.id, existing.id))
      .returning();
    return restored;
  }

  const [device] = await db
    .insert(userDevices)
    .values({
      userId: params.userId,
      deviceIdentifier: devId,
      deviceName: params.deviceName || 'Web Browser',
      platform: params.platform || 'Web',
      userAgent: params.userAgent || '',
      ipAddress: params.ipAddress || '',
      lastActiveAt: new Date(),
      isRevoked: false,
    })
    .onConflictDoUpdate({
      target: [userDevices.userId, userDevices.deviceIdentifier],
      set: {
        deviceName: params.deviceName || 'Web Browser',
        platform: params.platform || 'Web',
        userAgent: params.userAgent || '',
        ipAddress: params.ipAddress || '',
        lastActiveAt: new Date(),
      },
    })
    .returning();

  return device;
}

const registerSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(6).max(24).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required').max(120),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
  activateFreeTrial: z.boolean().optional(),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const email = parsed.data.email?.trim().toLowerCase() || null;
    const phone = parsed.data.phone?.trim() || null;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Please provide an email address or phone number' });
    }

    const checks = [];
    if (email) checks.push(eq(users.email, email));
    if (phone) checks.push(eq(users.phone, phone));

    const [existing] = await db.select().from(users).where(or(...checks));
    if (existing) {
      return res.status(409).json({ error: 'An account with this email or phone already exists' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const uid = `local_${crypto.randomUUID()}`;

    const [createdUser] = await db
      .insert(users)
      .values({
        uid,
        email,
        phone,
        passwordHash,
        fullName: parsed.data.fullName.trim(),
        role: 'user',
        emailVerified: false,
        trialUsed: false,
        trialDeviceFingerprint: parsed.data.deviceFingerprint || null,
        status: 'active',
      })
      .returning();

    await ensureUserWallet(createdUser.id);
    await upsertUserDevice({
      userId: createdUser.id,
      deviceIdentifier: parsed.data.deviceFingerprint,
      deviceName: parsed.data.deviceName || 'Web Browser',
      platform: parsed.data.platform || 'Web',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    let verificationToken: string | null = null;
    if (email) {
      verificationToken = crypto.randomBytes(24).toString('hex');
      await db.insert(emailVerifications).values({
        userId: createdUser.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    let trialWarning: string | null = null;
    let activatedTrial = false;
    if (parsed.data.activateFreeTrial !== false) {
      const [trialPkg] = await db.select().from(packages).where(eq(packages.isTrial, true));
      if (trialPkg) {
        try {
          await activateUserSubscription({
            userId: createdUser.id,
            packageId: trialPkg.id,
            paymentMethod: 'trial',
            deviceFingerprint: parsed.data.deviceFingerprint,
          });
          activatedTrial = true;
        } catch (trialErr: any) {
          trialWarning = trialErr?.message || 'Free trial was not activated due to device eligibility.';
        }
      }
    }

    const token = signSessionToken({
      id: createdUser.id,
      uid: createdUser.uid,
      role: createdUser.role,
    });
    setSessionCookie(req, res, token);

    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

    res.status(201).json({
      user: {
        id: createdUser.id,
        uid: createdUser.uid,
        email: createdUser.email,
        phone: createdUser.phone,
        fullName: createdUser.fullName,
        role: createdUser.role,
        emailVerified: createdUser.emailVerified,
        trialUsed: activatedTrial,
      },
      token,
      activatedTrial,
      trialWarning,
      emailVerification: email
        ? {
            sent: smtpConfigured,
            verificationToken: smtpConfigured ? undefined : verificationToken,
          }
        : null,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials' });
    }

    const identifier = parsed.data.identifier.trim();
    const emailCandidate = identifier.toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, emailCandidate), eq(users.phone, identifier)));

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account has been suspended by an administrator' });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email/phone or password' });
    }

    await ensureUserWallet(user.id);
    await upsertUserDevice({
      userId: user.id,
      deviceIdentifier: parsed.data.deviceFingerprint,
      deviceName: parsed.data.deviceName || 'Web Browser',
      platform: parsed.data.platform || 'Web',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const token = signSessionToken({ id: user.id, uid: user.uid, role: user.role });
    setSessionCookie(req, res, token);

    res.json({
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified,
        trialUsed: user.trialUsed,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

async function verifyGoogleOrFirebaseToken(idToken: string): Promise<{
  uid: string;
  email: string | null;
  name: string | null;
  picture: string;
  emailVerified: boolean;
}> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email?.toLowerCase() || null,
      name: decoded.name || null,
      picture: decoded.picture || '',
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch (firebaseErr) {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!resp.ok) {
      throw firebaseErr;
    }
    const info = (await resp.json()) as Record<string, any>;
    const validAudiences = [firebaseConfig.oAuthClientId, firebaseConfig.projectId].filter(Boolean);
    if (!info?.sub || (validAudiences.length > 0 && !validAudiences.includes(String(info.aud)))) {
      throw firebaseErr;
    }
    return {
      uid: `google_${info.sub}`,
      email: info.email ? String(info.email).toLowerCase() : null,
      name: info.name ? String(info.name) : null,
      picture: info.picture ? String(info.picture) : '',
      emailVerified: info.email_verified === true || info.email_verified === 'true',
    };
  }
}

router.post('/google', async (req, res) => {
  try {
    const { idToken, deviceFingerprint, deviceName, platform, activateFreeTrial } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Missing Google ID token' });
    }

    const decoded = await verifyGoogleOrFirebaseToken(idToken);
    const email = decoded.email;
    const fullName = decoded.name || (email ? email.split('@')[0] : 'VEXORA Member');

    const [existingByUid] = await db.select().from(users).where(eq(users.uid, decoded.uid));
    let userRow = existingByUid;
    let isNewUser = false;

    if (!userRow && email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
      if (existingByEmail) {
        [userRow] = await db
          .update(users)
          .set({
            uid: decoded.uid,
            emailVerified: decoded.emailVerified || existingByEmail.emailVerified,
            avatarUrl: decoded.picture || existingByEmail.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
      }
    }

    if (!userRow) {
      isNewUser = true;
      [userRow] = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email,
          fullName,
          avatarUrl: decoded.picture || '',
          role: 'user',
          emailVerified: decoded.emailVerified,
          trialUsed: false,
          trialDeviceFingerprint: deviceFingerprint || null,
          status: 'active',
        })
        .returning();
    }

    if (userRow.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    await ensureUserWallet(userRow.id);
    await upsertUserDevice({
      userId: userRow.id,
      deviceIdentifier: deviceFingerprint,
      deviceName: deviceName || 'Google Chrome Web',
      platform: platform || 'Web',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    let activatedTrial = false;
    let trialWarning: string | null = null;
    if (isNewUser && activateFreeTrial !== false && !userRow.trialUsed) {
      const [trialPkg] = await db.select().from(packages).where(eq(packages.isTrial, true));
      if (trialPkg) {
        try {
          await activateUserSubscription({
            userId: userRow.id,
            packageId: trialPkg.id,
            paymentMethod: 'trial',
            deviceFingerprint,
          });
          activatedTrial = true;
          userRow = { ...userRow, trialUsed: true };
        } catch (trialErr: any) {
          trialWarning = trialErr?.message || 'Free trial was not activated due to device eligibility.';
        }
      }
    }

    const token = signSessionToken({ id: userRow.id, uid: userRow.uid, role: userRow.role });
    setSessionCookie(req, res, token);

    res.json({
      user: {
        id: userRow.id,
        uid: userRow.uid,
        email: userRow.email,
        phone: userRow.phone,
        fullName: userRow.fullName,
        avatarUrl: userRow.avatarUrl,
        role: userRow.role,
        emailVerified: userRow.emailVerified,
        trialUsed: userRow.trialUsed,
      },
      token,
      isNewUser,
      activatedTrial,
      trialWarning,
    });
  } catch (err) {
    console.error('Google OAuth verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired Google Sign-In token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(req));
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    const wallet = await ensureUserWallet(user.id);

    const activeSubs = await db
      .select({
        subscription: subscriptions,
        package: packages,
      })
      .from(subscriptions)
      .innerJoin(packages, eq(subscriptions.packageId, packages.id))
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1);

    let activeSubscription = null;
    if (activeSubs[0]) {
      const sub = activeSubs[0].subscription;
      if (new Date(sub.expiresAt) > new Date()) {
        activeSubscription = { ...sub, package: activeSubs[0].package };
      } else {
        await db.update(subscriptions).set({ status: 'expired' }).where(eq(subscriptions.id, sub.id));
      }
    }

    const devices = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, user.id), eq(userDevices.isRevoked, false)))
      .orderBy(desc(userDevices.lastActiveAt));

    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(or(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    res.json({
      user,
      wallet,
      activeSubscription,
      devices,
      notifications: unreadNotifications,
    });
  } catch (err) {
    console.error('/auth/me error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, phone, avatarUrl } = req.body || {};
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      updates.fullName = fullName.trim();
    }
    if (typeof phone === 'string') {
      updates.phone = phone.trim() || null;
    }
    if (typeof avatarUrl === 'string') {
      updates.avatarUrl = avatarUrl.trim();
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.currentUser!.id))
      .returning();

    res.json({
      user: {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        phone: updated.phone,
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        emailVerified: updated.emailVerified,
        trialUsed: updated.trialUsed,
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Phone number is already linked to another account' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/verify-email/request', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.currentUser!;
    if (!user.email) {
      return res.status(400).json({ error: 'No email address associated with this account' });
    }
    if (user.emailVerified) {
      return res.json({ alreadyVerified: true });
    }

    const token = crypto.randomBytes(24).toString('hex');
    await db.insert(emailVerifications).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    res.json({
      sent: smtpConfigured,
      message: smtpConfigured
        ? 'Verification email dispatched.'
        : 'SMTP is not configured in environment; verification token generated for direct verification.',
      verificationToken: smtpConfigured ? undefined : token,
    });
  } catch (err) {
    console.error('verify-email/request error:', err);
    res.status(500).json({ error: 'Failed to create verification token' });
  }
});

router.post('/verify-email/confirm', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const [record] = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token));

    if (!record || record.verifiedAt || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Verification token is invalid or expired' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailVerifications)
        .set({ verifiedAt: new Date() })
        .where(eq(emailVerifications.id, record.id));
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, record.userId));
    });

    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ error: 'Email verification failed' });
  }
});

router.post('/password-reset/request', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    if (!user) {
      return res.json({
        ok: true,
        message: 'If an account exists for that email, a reset link has been generated.',
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    res.json({
      ok: true,
      sent: smtpConfigured,
      message: smtpConfigured
        ? 'Password reset instructions sent to your email.'
        : 'SMTP is not configured; reset token issued for testing/direct reset.',
      resetToken: smtpConfigured ? undefined : token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request password reset' });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string' || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Valid token and password (min 8 chars) are required' });
    }

    const [record] = await db.select().from(passwordResets).where(eq(passwordResets.token, token));
    if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await db.transaction(async (tx) => {
      await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, record.id));
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, record.userId));
    });

    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.get('/devices', requireAuth, async (req: AuthRequest, res) => {
  const rows = await db
    .select()
    .from(userDevices)
    .where(eq(userDevices.userId, req.currentUser!.id))
    .orderBy(desc(userDevices.lastActiveAt));
  res.json({ devices: rows });
});

router.delete('/devices/:id', requireAuth, async (req: AuthRequest, res) => {
  const deviceId = Number(req.params.id);
  const [updated] = await db
    .update(userDevices)
    .set({ isRevoked: true })
    .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, req.currentUser!.id)))
    .returning();

  if (!updated) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json({ device: updated });
});

export default router;
