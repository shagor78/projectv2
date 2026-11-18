import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../../database/index.ts';
import { adminRoles, auditLogs, users } from '../../../database/schema/index.ts';
import { JWT_SECRET, SESSION_COOKIE_NAME } from '../config/env.ts';
import { adminAuth } from '../config/firebaseAdmin.ts';

export { SESSION_COOKIE_NAME };

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  roleId: number | null;
  permissions: string[];
  emailVerified: boolean;
  trialUsed: boolean;
  status: string;
}

export interface AuthRequest extends Request {
  currentUser?: AuthenticatedUser;
}

export function signSessionToken(user: { id: number; uid: string; role: string }): string {
  return jwt.sign({ userId: user.id, uid: user.uid, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifySessionToken(token: string): { userId: number; uid: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; uid: string; role: string };
  } catch {
    return null;
  }
}

async function loadUserWithPermissions(
  whereCol: 'id' | 'uid',
  value: number | string
): Promise<AuthenticatedUser | null> {
  const [userRow] = await db
    .select()
    .from(users)
    .where(whereCol === 'id' ? eq(users.id, Number(value)) : eq(users.uid, String(value)));

  if (!userRow) return null;

  let permissions: string[] = [];
  if (userRow.roleId) {
    const [roleRow] = await db.select().from(adminRoles).where(eq(adminRoles.id, userRow.roleId));
    if (roleRow) permissions = roleRow.permissions;
  } else if (userRow.role === 'super_admin' || userRow.role === 'admin') {
    permissions = ['*'];
  }

  return {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    phone: userRow.phone,
    fullName: userRow.fullName,
    avatarUrl: userRow.avatarUrl,
    role: userRow.role,
    roleId: userRow.roleId,
    permissions,
    emailVerified: userRow.emailVerified,
    trialUsed: userRow.trialUsed,
    status: userRow.status,
  };
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearerToken || cookieToken;

    if (!token) return next();

    const localDecoded = verifySessionToken(token);
    if (localDecoded) {
      const loaded = await loadUserWithPermissions('id', localDecoded.userId);
      if (loaded && loaded.status === 'active') {
        req.currentUser = loaded;
      }
      return next();
    }

    try {
      const firebaseDecoded = await adminAuth.verifyIdToken(token);
      const loaded = await loadUserWithPermissions('uid', firebaseDecoded.uid);
      if (loaded && loaded.status === 'active') {
        req.currentUser = loaded;
      }
    } catch {
      // Ignore invalid optional tokens
    }
    return next();
  } catch (err) {
    console.error('optionalAuth error:', err);
    return next();
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  await optionalAuth(req, res, () => {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.currentUser.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended' });
    }
    next();
  });
}

export function requireAdmin(permission?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      const user = req.currentUser;
      if (!user) return;
      const isAdminRole = ['admin', 'super_admin', 'editor', 'operator'].includes(user.role);
      if (!isAdminRole) {
        return res.status(403).json({ error: 'Administrator privileges required' });
      }
      if (
        permission &&
        !user.permissions.includes('*') &&
        !user.permissions.includes(permission)
      ) {
        return res.status(403).json({ error: `Missing permission: ${permission}` });
      }
      next();
    });
  };
}

export async function recordAuditLog(params: {
  actor?: AuthenticatedUser | null;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actor?.id ?? null,
      actorEmail: params.actor?.email || params.actor?.phone || 'system',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId !== undefined ? String(params.entityId) : '',
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? '',
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
