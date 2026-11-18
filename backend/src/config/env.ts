import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Workspace root (/app/applet) regardless of whether invoked from root or backend/
export const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
export const BACKEND_ROOT = path.resolve(WORKSPACE_ROOT, 'backend');
export const FRONTEND_ROOT = path.resolve(WORKSPACE_ROOT, 'frontend');
export const UPLOADS_DIR = path.resolve(BACKEND_ROOT, 'uploads');
export const FRONTEND_ASSETS_IMAGES_DIR = path.resolve(FRONTEND_ROOT, 'src', 'assets', 'images');
export const FRONTEND_PUBLIC_DIR = path.resolve(FRONTEND_ROOT, 'public');
export const DEFAULT_EXCEL_PATH = path.resolve(WORKSPACE_ROOT, 'dataexcel.xlsx');

export const SERVER_PORT = Number(process.env.PORT) || 3000;
export const FRONTEND_DEV_PORT = Number(process.env.FRONTEND_PORT) || 5173;
export const IS_STANDALONE_API = process.env.API_ONLY === 'true';

export const ALLOWED_CORS_ORIGINS = (
  process.env.CORS_ORIGIN ||
  `http://localhost:${FRONTEND_DEV_PORT},http://127.0.0.1:${FRONTEND_DEV_PORT},http://localhost:${SERVER_PORT},http://127.0.0.1:${SERVER_PORT}`
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const SESSION_COOKIE_NAME = 'velostream_session';

export const JWT_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('velostream-dev-session-secret-key').digest('hex');
