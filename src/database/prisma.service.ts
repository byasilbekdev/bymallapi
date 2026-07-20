import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 no longer reads the connection string from schema.prisma
    // at runtime — it must be passed explicitly. We use DATABASE_URL
    // (the pgbouncer pooled connection) here, since this is the client
    // used by the running application under normal request load.
    // CLI operations (migrate/generate) use DIRECT_URL instead — see
    // prisma.config.ts at the project root.
    super({
      datasourceUrl: process.env.DATABASE_URL,
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
