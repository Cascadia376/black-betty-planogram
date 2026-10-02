export interface BusinessClock {
  today(): string;
  now(): string;
}

const PERMANENT_PACIFIC_TIME_START = Date.parse("2026-03-08T10:00:00.000Z");
const PERMANENT_PACIFIC_OFFSET_MS = 7 * 60 * 60 * 1000;

function vancouverBusinessDate(instant: Date): string {
  // B.C. moved to permanent UTC-7 after its final clock change on 8 March 2026.
  // Calculate that rule explicitly because older host time-zone databases still
  // apply a November fallback to America/Vancouver.
  if (instant.getTime() >= PERMANENT_PACIFIC_TIME_START) {
    return new Date(instant.getTime() - PERMANENT_PACIFIC_OFFSET_MS).toISOString().slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const value = (name: string) => parts.find((part) => part.type === name)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export class SystemBusinessClock implements BusinessClock {
  constructor(private readonly nowDate: () => Date = () => new Date()) {}

  today() {
    return vancouverBusinessDate(this.nowDate());
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
