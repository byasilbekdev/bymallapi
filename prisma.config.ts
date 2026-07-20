import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads datasource.url from schema.prisma.
// The Prisma CLI (generate, migrate, studio) reads its connection URL
// from here instead. We use DIRECT_URL (not the pgbouncer pooler URL)
// because migrations need a direct connection — pgbouncer's transaction
// mode doesn't support the prepared statements Prisma Migrate issues.
//
// The running application (PrismaService) does NOT use this file; it
// passes DATABASE_URL (the pooled connection) directly to PrismaClient
// at runtime. See src/database/prisma.service.ts.
export default defineConfig({
  schema: 'src/prisma/schema.prisma',
  migrations: {
    path: 'src/prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
