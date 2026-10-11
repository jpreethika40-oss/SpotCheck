import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://spotcheck:spotcheck@127.0.0.1:5433/spotcheck?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'spotcheck_dev_jwt_secret_key_83749281749283749283749',
  cookieSecret: process.env.COOKIE_SECRET || 'spotcheck_dev_cookie_secret_98374928174928374928',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  storageDir: path.resolve(__dirname, '../uploads'),
  jwtExpiresIn: '7d',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};
