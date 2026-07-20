import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL,
  cookieSecret: process.env.COOKIE_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
}));
