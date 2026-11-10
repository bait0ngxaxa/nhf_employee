import { PrismaClient, type Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Production logs only error + warn (connection failures, pool exhaustion,
// engine warnings). Never enable 'query' or 'info' in production: they can
// expose query parameters/PII in logs.
const PRODUCTION_LOG_LEVELS: Prisma.LogLevel[] = ['error', 'warn'];
const DEVELOPMENT_LOG_LEVELS: Prisma.LogLevel[] = ['error'];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? PRODUCTION_LOG_LEVELS
        : DEVELOPMENT_LOG_LEVELS,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;