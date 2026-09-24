import { describe, expect, it } from "vitest";
import { SystemBusinessClock } from "./clock";

describe("Vancouver business clock", () => {
  it.each([
    ["2026-09-22T06:59:59.000Z", "2026-09-21"],
    ["2026-09-22T07:00:00.000Z", "2026-09-22"],
    ["2026-12-02T07:59:59.000Z", "2026-12-01"],
    ["2026-12-02T08:00:00.000Z", "2026-12-02"],
  ])("uses the store date at %s and keeps the audit timestamp in UTC", (instant, date) => {
    const clock = new SystemBusinessClock(() => new Date(instant));
    expect(clock.today()).toBe(date);
    expect(clock.now()).toBe(instant);
  });
});
