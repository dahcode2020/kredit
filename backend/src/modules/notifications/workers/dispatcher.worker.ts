import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class DispatcherWorker {
  private logger = new Logger(DispatcherWorker.name);
  private worker: Worker | null = null;
  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.SKIP_WORKERS === 'true') return;
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.worker = new Worker('notifications.dispatch', async job => {
      const { event, customerId, payload, entityId } = job.data;
      await this.notifications.dispatch(event, customerId, payload, entityId);
    }, { connection, concurrency: 10 });
    this.worker.on('failed', (job, err) => this.logger.error(`dispatch ${job?.id} failed ${err.message}`));
  }
}
