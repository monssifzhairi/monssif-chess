export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, number[]>();
  private lastSweepAt = Date.now();

  constructor(options: { maxRequests: number; windowMs: number }) {
    this.maxRequests = Math.max(1, options.maxRequests);
    this.windowMs = Math.max(1000, options.windowMs);
  }

  public consume(key: string, now = Date.now()): RateLimitResult {
    this.maybeSweep(now);
    const cutoff = now - this.windowMs;
    const existing = this.buckets.get(key) || [];
    const active = existing.filter((ts) => ts > cutoff);

    if (active.length >= this.maxRequests) {
      this.buckets.set(key, active);
      const oldest = active[0];
      const retryAfterMs = Math.max(1000, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
      };
    }

    active.push(now);
    this.buckets.set(key, active);
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - active.length),
      retryAfterSec: 0,
    };
  }

  private maybeSweep(now: number): void {
    if (now - this.lastSweepAt < this.windowMs) return;
    this.lastSweepAt = now;
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.buckets.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, fresh);
      }
    }
  }
}
