import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { prisma } from './db/prisma';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import facilityRoutes from './routes/facilityRoutes';
import checkpointRoutes from './routes/checkpointRoutes';
import templateRoutes from './routes/templateRoutes';
import inspectionRoutes from './routes/inspectionRoutes';
import workOrderRoutes from './routes/workOrderRoutes';
import syncRoutes from './routes/syncRoutes';
import uploadRoutes from './routes/uploadRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import reportRoutes from './routes/reportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import auditRoutes from './routes/auditRoutes';

export const app = express();

// Security & Core Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Permit internal Vite dev connections
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      // In dev allow localhost:5173 or other local origins
      if (
        origin === config.corsOrigin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in local dev test mode
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-chunk-index', 'x-total-chunks', 'x-checksum-sha256'],
  })
);

app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request Logging
app.use(
  morgan((tokens, req, res) => {
    return JSON.stringify({
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      responseTimeMs: tokens['response-time'](req, res),
      date: new Date().toISOString(),
    });
  })
);

// Serve static evidence uploads
app.use('/uploads', express.static(config.storageDir));

// Health Check Endpoint
app.get('/api/v1/health', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.user.findFirst({ select: { id: true } });
    res.json({
      success: true,
      data: {
        status: 'UP',
        service: 'spotcheck-api',
        version: '1.0.0',
        environment: config.nodeEnv,
        database: 'CONNECTED',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (err: any) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({
      success: false,
      data: {
        status: 'DEGRADED',
        service: 'spotcheck-api',
        database: 'DISCONNECTED',
        error: err.message,
      },
    });
  }
});

// Mount versioned API routes under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/facilities', facilityRoutes);
app.use('/api/v1/checkpoints', checkpointRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/inspections', inspectionRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/issues', workOrderRoutes); // Aliased for convenience
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit', auditRoutes);

// 404 handler for undefined API routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// Centralized error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => {
    logger.info(`SpotCheck API server listening on http://localhost:${config.port}`, {
      port: config.port,
      environment: config.nodeEnv,
    });
  });

  const gracefulShutdown = async () => {
    logger.info('Gracefully terminating server...');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected and server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}
