import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Wrapper minimal BullMQ (en prod injecté via @InjectQueue)
@Injectable()
export class NotificationsQueue {
  private logger = new Logger(NotificationsQueue.name);
  private connection: IORedis;
  private queues: Record<string, Queue> = {};
  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connection = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
    this.connection.on('error', (e) => this.logger.warn(`Redis ${e.message}`));
    for (const name of ['notifications.dispatch','notifications.send.email','notifications.send.sms','notifications.send.whatsapp','notifications.send.push','notifications.retry','notifications.dlq']) {
      this.queues[name] = new Queue(name, { connection: this.connection });
    }
  }
  async add(queue: string, data: any, opts?: any) {
    const q = this.queues[queue];
    if (!q) throw new Error(`unknown queue ${queue}`);
    return q.add(queue, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
      jobId: opts?.jobId,
      ...opts,
    });
  }
  getQueue(name: string) { return this.queues[name]; }
}
