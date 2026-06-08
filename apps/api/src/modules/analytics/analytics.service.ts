import { redis } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { analyticsRepository } from './analytics.repository.js';
import type { AnalyticsOverview, UserGrowthPoint, ActivityPoint } from '@bract/shared';

const CACHE_TTL = 300; // 5 minutos — README §13

const CACHE_KEYS = {
  overview: 'analytics:overview',
  users: (days: number) => `analytics:users:${days}`,
  activity: (days: number) => `analytics:activity:${days}`,
} as const;

async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch (err) {
    logger.warn({ message: 'Redis cache read failed', key, error: (err as Error).message });
    return null;
  }
}

async function setCache(key: string, value: unknown): Promise<void> {
  try {
    await redis.set(key, value, { ex: CACHE_TTL });
  } catch (err) {
    logger.warn({ message: 'Redis cache write failed', key, error: (err as Error).message });
  }
}

export const analyticsService = {
  async getOverview(): Promise<AnalyticsOverview> {
    const cached = await getFromCache<AnalyticsOverview>(CACHE_KEYS.overview);
    if (cached) return cached;

    const data = await analyticsRepository.getOverview();
    await setCache(CACHE_KEYS.overview, data);
    return data;
  },

  async getUserGrowthSeries(days: number): Promise<UserGrowthPoint[]> {
    const cached = await getFromCache<UserGrowthPoint[]>(CACHE_KEYS.users(days));
    if (cached) return cached;

    const data = await analyticsRepository.getUserGrowthSeries(days);
    await setCache(CACHE_KEYS.users(days), data);
    return data;
  },

  async getActivitySeries(days: number): Promise<ActivityPoint[]> {
    const cached = await getFromCache<ActivityPoint[]>(CACHE_KEYS.activity(days));
    if (cached) return cached;

    const data = await analyticsRepository.getActivitySeries(days);
    await setCache(CACHE_KEYS.activity(days), data);
    return data;
  },
};
