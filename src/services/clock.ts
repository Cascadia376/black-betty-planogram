export interface BusinessClock {
  today(): string;
  now(): string;
}

export class SystemBusinessClock implements BusinessClock {
  constructor(private readonly nowDate: () => Date = () => new Date()) {}

  today() {
    // Store trading dates are Vancouver-local; audit timestamps remain UTC.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(this.nowDate());
    const value = (name: string) => parts.find((part) => part.type === name)!.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  }

  now() {
    return this.nowDate().toISOString();
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
