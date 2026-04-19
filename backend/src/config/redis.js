import { Redis } from 'ioredis'
import dotenv from 'dotenv'
dotenv.config()

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: null, // BullMQ 요구사항
})

redis.on('error', (err) => {
  console.error('[redis] 연결 오류:', err.message)
})

redis.on('connect', () => {
  console.log('[redis] 연결됨')
})

export default redis
