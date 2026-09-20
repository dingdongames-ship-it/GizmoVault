export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;    // Number of failures before tripping open (default: 5)
  cooldownPeriodMs?: number;    // Time in ms to stay OPEN before HALF_OPEN (default: 10000)
  requestTimeoutMs?: number;    // Timeout per operation call (default: 5000)
}

export class CircuitBreaker {
  public state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private nextAttempt = Date.now();
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly requestTimeoutMs: number;

  constructor(public readonly name: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownPeriodMs = options.cooldownPeriodMs || 10000;
    this.requestTimeoutMs = options.requestTimeoutMs || 5000;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`[CircuitBreaker:${this.name}] Circuit is OPEN — fast failing request`);
      }
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      // Execute with timeout
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`[CircuitBreaker:${this.name}] Operation timed out`)), this.requestTimeoutMs);
        }),
      ]);

      if (timer) clearTimeout(timer);
      this.onSuccess();
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownPeriodMs;
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }
}

/**
 * Exponential backoff with jitter retry wrapper
 */
export async function withRetry<T>(
  action: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelayMs = options.baseDelayMs || 50;
  const maxDelayMs = options.maxDelayMs || 1000;

  let attempt = 0;
  while (true) {
    try {
      return await action();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxRetries) {
        throw err;
      }
      // Full jitter exponential backoff: random between 0 and min(maxDelay, base * 2^attempt)
      const calculated = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitterDelay = Math.floor(Math.random() * calculated);
      await new Promise(res => setTimeout(res, jitterDelay));
    }
  }
}
