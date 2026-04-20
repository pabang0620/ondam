/**
 * 구독 자동결제 BullMQ Queue
 */

import { Queue } from 'bullmq'
import redis from '../config/redis.js'

export const billingQueue = new Queue('subscription-billing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
})
