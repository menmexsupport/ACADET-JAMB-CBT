import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import { runMigrations } from './src/db/migrate.ts';
import { runSeed } from './src/db/seed.ts';
import { getDatabaseMode } from './src/db/index.ts';
import publicRoutes from './src/server/routes/public.ts';
import authRoutes from './src/server/routes/auth.ts';
import examRoutes from './src/server/routes/exams.ts';
import studentRoutes from './src/server/routes/student.ts';
import adminRoutes from './src/server/routes/admin.ts';

async function bootstrap() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.use(
    cors({
      origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  // Rate limiting on authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Please wait a few minutes and try again.' },
  });
  app.use('/api/auth', authLimiter);

  // Run DB migrations and idempotent initial seed
  await runMigrations();
  await runSeed();

  // Uploaded files static serving
  const uploadsDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // REST API Routes
  app.use('/api', publicRoutes);
  app.use('/api', authRoutes);
  app.use('/api', examRoutes);
  app.use('/api', studentRoutes);
  app.use('/api', adminRoutes);

  // API 404 handler
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[Acadet JAMB CBT] Listening on http://0.0.0.0:${port} (db=${getDatabaseMode()}, env=${isProd ? 'production' : 'development'})`);
  });

  const shutdown = async () => {
    const { closeDatabase } = await import('./src/db/index.ts');
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    setTimeout(async () => {
      await closeDatabase();
      process.exit(0);
    }, 3000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Acadet JAMB CBT] Fatal startup error:', err);
  process.exit(1);
});
