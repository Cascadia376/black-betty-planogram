export interface BusinessClock {
  today(): string;
  now(): string;
}

export class SystemBusinessClock implements BusinessClock {
  today() {
    return new Date().toISOString().slice(0, 10);
  }

  now() {
    return new Date().toISOString();
  }
}

export class FixedBusinessClock implements BusinessClock {
  constructor(private readonly date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fixed business date must use YYYY-MM-DD.");
  }

  today() {
    return this.date;
  }

  now() {
    return `${this.date}T16:00:00.000Z`;
  }
}

// Mock mode is intentionally deterministic. A production adapter can inject SystemBusinessClock.
export const mockBusinessClock = new FixedBusinessClock("2026-09-24");
