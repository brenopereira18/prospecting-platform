import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareMonthlyValues,
  getCommercialPeriods,
  getHistoryCoverage,
} from "./commercial-month";

const now = new Date("2026-10-22T15:30:00Z");

test("defaults to the current business month and validates the entire YYYY-MM value", () => {
  for (const value of [undefined, "2026-10"]) {
    const periods = getCommercialPeriods(value, now);
    assert.equal(periods.month, "2026-10");
    assert.equal(periods.selectionWarning, null);
    assert.equal(periods.partial, true);
    assert.equal(periods.end.toISOString(), now.toISOString());
  }
  for (const value of [
    "2026-1",
    "2026-13",
    "2026-00",
    "2026-10-extra",
    ["2026-09"],
    "",
    "2026-11",
  ]) {
    const periods = getCommercialPeriods(value, now);
    assert.equal(periods.month, "2026-10");
    assert.ok(periods.selectionWarning);
  }
});

test("uses São Paulo to determine today's month even when UTC is already in the next month", () => {
  const periods = getCommercialPeriods(
    undefined,
    new Date("2026-11-01T01:30:00Z"),
  );
  assert.equal(periods.month, "2026-10");
  assert.equal(periods.previousMonth, "2026-09");
});

test("closed months use exclusive local boundaries; previous month crosses year and leap February", () => {
  const january = getCommercialPeriods("2026-01", now);
  assert.equal(january.previousMonth, "2025-12");
  assert.equal(january.previousStart.toISOString(), "2025-12-01T03:00:00.000Z");
  assert.equal(january.start.toISOString(), "2026-01-01T03:00:00.000Z");
  assert.equal(january.end.toISOString(), "2026-02-01T03:00:00.000Z");
  assert.equal(january.partial, false);
  const february = getCommercialPeriods("2024-02", now);
  assert.equal(february.end.toISOString(), "2024-03-01T03:00:00.000Z");
});

test("IANA timezone boundaries preserve historical daylight saving offsets", () => {
  const november = getCommercialPeriods("2018-11", now);
  assert.equal(november.start.toISOString(), "2018-11-01T03:00:00.000Z");
  assert.equal(november.end.toISOString(), "2018-12-01T02:00:00.000Z");
});

test("current totals include today but comparison excludes the incomplete day on both months", () => {
  const period = getCommercialPeriods("2026-10", now);
  assert.equal(period.end.toISOString(), "2026-10-22T15:30:00.000Z");
  assert.equal(period.comparison.completeDays, 21);
  assert.equal(
    period.comparison.currentEnd.toISOString(),
    "2026-10-22T03:00:00.000Z",
  );
  assert.equal(
    period.comparison.previousEnd.toISOString(),
    "2026-09-22T03:00:00.000Z",
  );
  assert.match(
    period.comparison.label,
    /1 a 21 de outubro de 2026 vs\. 1 a 21 de setembro de 2026/,
  );
});

test("closed months compare full months even when their lengths differ", () => {
  const period = getCommercialPeriods("2026-02", now);
  assert.equal(period.comparison.completeDays, null);
  assert.equal(
    period.comparison.currentEnd.toISOString(),
    "2026-03-01T03:00:00.000Z",
  );
  assert.equal(
    period.comparison.previousEnd.toISOString(),
    "2026-02-01T03:00:00.000Z",
  );
  assert.equal(period.comparison.available, true);
});

test("current January compares full elapsed days with December across the year boundary", () => {
  const period = getCommercialPeriods(
    undefined,
    new Date("2027-01-22T14:00:00Z"),
  );
  assert.equal(period.previousMonth, "2026-12");
  assert.equal(period.comparison.completeDays, 21);
  assert.equal(
    period.comparison.previousEnd.toISOString(),
    "2026-12-22T03:00:00.000Z",
  );
});

test("equivalent windows clamp March to leap/non-leap February and a 31-day month to 30 days", () => {
  for (const [instant, days, currentEnd, previousEnd] of [
    [
      "2024-03-31T15:00:00Z",
      29,
      "2024-03-30T03:00:00.000Z",
      "2024-03-01T03:00:00.000Z",
    ],
    [
      "2025-03-31T15:00:00Z",
      28,
      "2025-03-29T03:00:00.000Z",
      "2025-03-01T03:00:00.000Z",
    ],
    [
      "2026-07-31T15:00:00Z",
      30,
      "2026-07-31T03:00:00.000Z",
      "2026-07-01T03:00:00.000Z",
    ],
    [
      "2024-02-29T15:00:00Z",
      28,
      "2024-02-29T03:00:00.000Z",
      "2024-01-29T03:00:00.000Z",
    ],
    [
      "2025-02-28T15:00:00Z",
      27,
      "2025-02-28T03:00:00.000Z",
      "2025-01-28T03:00:00.000Z",
    ],
  ] as const) {
    const period = getCommercialPeriods(undefined, new Date(instant));
    assert.equal(period.comparison.completeDays, days);
    assert.equal(period.comparison.currentEnd.toISOString(), currentEnd);
    assert.equal(period.comparison.previousEnd.toISOString(), previousEnd);
  }
});

test("business midnight, not server/UTC date, defines complete days; day one has no comparison", () => {
  const beforeMidnight = getCommercialPeriods(
    undefined,
    new Date("2026-10-22T02:59:59.999Z"),
  );
  const afterMidnight = getCommercialPeriods(
    undefined,
    new Date("2026-10-22T03:00:00Z"),
  );
  assert.equal(beforeMidnight.comparison.completeDays, 20);
  assert.equal(afterMidnight.comparison.completeDays, 21);
  const first = getCommercialPeriods(
    undefined,
    new Date("2026-11-01T03:00:00Z"),
  );
  assert.equal(first.comparison.completeDays, 0);
  assert.equal(first.comparison.available, false);
  assert.equal(
    first.comparison.currentEnd.toISOString(),
    first.start.toISOString(),
  );
  assert.equal(
    first.comparison.previousEnd.toISOString(),
    first.previousStart.toISOString(),
  );
});

test("a historical midnight DST gap uses the start of the local day without leaking the previous day", () => {
  const period = getCommercialPeriods(
    undefined,
    new Date("2018-11-04T14:00:00Z"),
  );
  assert.equal(period.comparison.completeDays, 3);
  assert.equal(
    period.comparison.currentEnd.toISOString(),
    "2018-11-04T03:00:00.000Z",
  );
});

test("comparison handles increases, decreases, stability and zero bases without infinity", () => {
  assert.deepEqual(compareMonthlyValues(6, 4), {
    current: 6,
    previous: 4,
    difference: 2,
    percentageChange: 50,
    comparison: "comparable",
  });
  assert.equal(compareMonthlyValues(1, 4).percentageChange, -75);
  assert.equal(compareMonthlyValues(0, 0).comparison, "stable");
  assert.equal(compareMonthlyValues(4, 4).comparison, "stable");
  assert.deepEqual(compareMonthlyValues(3, 0), {
    current: 3,
    previous: 0,
    difference: 3,
    percentageChange: null,
    comparison: "no-base",
  });
  assert.equal(compareMonthlyValues(3, null).comparison, "unavailable");
  assert.equal(compareMonthlyValues(3, 1, false).difference, null);
});

test("coverage differentiates missing, partial, covered and unknown history without inventing events", () => {
  const start = new Date("2026-09-01T03:00:00Z");
  const end = new Date("2026-10-01T03:00:00Z");
  assert.equal(getHistoryCoverage(start, end, null), "unknown");
  assert.equal(getHistoryCoverage(start, end, end), "unavailable");
  assert.equal(
    getHistoryCoverage(start, end, new Date("2026-09-20T14:00:00Z")),
    "partial",
  );
  assert.equal(getHistoryCoverage(start, end, start), "complete");
});
