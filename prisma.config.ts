import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

// Prisma 7 CLI config (migrate/generate/studio). Connection URL moved here
// from schema.prisma's datasource block; the runtime PrismaClient adapter
// in src/lib/db.ts reads DATABASE_URL separately.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
