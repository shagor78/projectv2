import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { ensureSeeded } from '../../database/seeds/seed.ts';
import {
  ALLOWED_CORS_ORIGINS,
  FRONTEND_ASSETS_IMAGES_DIR,
  FRONTEND_PUBLIC_DIR,
  FRONTEND_ROOT,
  IS_STANDALONE_API,
  UPLOADS_DIR,
  WORKSPACE_ROOT,
} from './config/env.ts';
import { handleHealthCheck } from './controllers/healthController.ts';
import adminRoutes from './routes/adminRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import publicRoutes from './routes/publicRoutes.ts';
import userRoutes from './routes/userRoutes.ts';

export async function createApp(options?: { mountFrontend?: boolean }) {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_CORS_ORIGINS.includes(origin) || origin.endsWith('.aistudio.google.com')) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Serve backend uploads & storefront cinema artwork consistently in dev, split mode & prod
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR));
  if (fs.existsSync(FRONTEND_ASSETS_IMAGES_DIR)) {
    app.use('/src/assets/images', express.static(FRONTEND_ASSETS_IMAGES_DIR));
  }
  if (fs.existsSync(path.join(FRONTEND_PUBLIC_DIR, 'assets'))) {
    app.use('/assets', express.static(path.join(FRONTEND_PUBLIC_DIR, 'assets')));
  }
  const workspaceAssetsDir = path.resolve(WORKSPACE_ROOT, 'public', 'assets');
  if (fs.existsSync(workspaceAssetsDir)) {
    app.use('/assets', express.static(workspaceAssetsDir));
  }

  app.get('/api/health', handleHealthCheck);

  // Lazily ensure seed data exists on first API call
  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureSeeded();
      next();
    } catch (err) {
      console.error('Database seed/connectivity check failed:', err);
      next();
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', userRoutes);
  app.use('/api/admin', adminRoutes);

  if (options?.mountFrontend === false || process.env.VITEST || IS_STANDALONE_API) {
    return app;
  }

  const distDir = path.resolve(WORKSPACE_ROOT, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distDir, 'index.html'));

  if (process.env.NODE_ENV === 'production' && hasDistBuild) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      configFile: path.resolve(FRONTEND_ROOT, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}
