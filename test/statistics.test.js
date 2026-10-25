import test from "node:test";
import assert from "node:assert/strict";
import { loadFeedings, periodStatistics, feedingIntervals, periodStart } from "../src/statistics.js";
const row = (id, fedAt, childId = "a") => ({ _id: id, fedAt, childId, consumedMl: 90 });

test("all-time loading has no date boundaries and follows every page, including more than 500 rows", async () => {
  const paths = [];
  const result = await loadFeedings(async path => {
    paths.push(path);
    const cursor = new URL(path, "https://test.invalid").searchParams.get("cursor");
    return cursor ? { items: Array.from({ length: 101 }, (_, i) => ({ _id: `old-${i}` })), nextCursor: null } : { items: Array.from({ length: 500 }, (_, i) => ({ _id: `new-${i}` })), nextCursor: "next/+=" };
  }, { allTime: true });
  assert.equal(result.length, 601);
  for (const path of paths) {
    const params = new URL(path, "https://test.invalid").searchParams;
    assert.equal(params.has("from"), false);
    assert.equal(params.has("to"), false);
  }
  assert.equal(new URL(paths[1], "https://test.invalid").searchParams.get("cursor"), "next/+=");
});

test("all-time statistics include old years and preserve child filtering; chart sums equal the full history", () => {
  const records = [row("old", "2020-01-01T00:00:00Z"), row("now", "2026-10-25T12:00:00Z"), row("other", "2024-01-01T00:00:00Z", "b")];
  const all = periodStatistics(records, { period: "all", today: "2026-10-25", offset: 2 });
  assert.equal(all.rows.length, 3);
  assert.equal(all.firstDay, "2020-01-01");
  assert.equal(all.monthly, true);
  assert.equal(all.buckets.reduce((sum, b) => sum + b.total, 0), 270);
  assert.equal(all.buckets[0].key, "2020-01-01");
  const child = periodStatistics(records, { period: "all", childId: "b", today: "2026-10-25", offset: 2 });
  assert.deepEqual(child.rows.map(r => r._id), ["other"]);
  assert.equal(child.buckets.reduce((sum, b) => sum + b.total, 0), 90);
});

test("fixed periods respect local calendar boundaries; empty all-time history has a valid chart", () => {
  const records = [row("in", "2026-10-24T23:30:00Z"), row("out", "2026-10-24T21:59:00Z")];
  const stats = periodStatistics(records, { period: 1, today: "2026-10-25", offset: 2 });
  assert.deepEqual(stats.rows.map(r => r._id), ["in"]);
  assert.equal(stats.buckets.length, 1);
  const empty = periodStatistics([], { period: "all", today: "2026-10-25", offset: 2 });
  assert.equal(empty.firstDay, "2026-10-25");
  assert.equal(empty.buckets.length, 1);
  assert.equal(empty.monthly, false);
});

test("intervals span the complete history and never mix children", () => {
  const records = [row("a2", "2026-10-25T12:00:00Z"), row("b", "2026-10-25T11:00:00Z", "b"), row("a1", "2026-10-25T10:00:00Z")];
  const intervals = feedingIntervals(records);
  assert.equal(intervals.get("a2"), 2 * 3600000);
  assert.equal(intervals.get("a1"), null);
  assert.equal(intervals.get("b"), null);
});

test("3/6/12 months follow the calendar across years, short months and leap days", () => {
  assert.equal(periodStart("2026-10-25", "3m"), "2026-07-25");
  assert.equal(periodStart("2026-10-25", "6m"), "2026-04-25");
  assert.equal(periodStart("2026-10-25", "12m"), "2025-10-25");
  assert.equal(periodStart("2026-05-31", "3m"), "2026-02-28");
  assert.equal(periodStart("2024-05-31", "3m"), "2024-02-29");
  assert.equal(periodStart("2024-02-29", "12m"), "2023-02-28");
  for (const period of ["3m", "6m", "12m"]) {
    const start = periodStart("2026-10-25", period);
    const boundary = +new Date(`${start}T00:00:00Z`) - 2 * 3600000;
    const records = [row("in", new Date(boundary).toISOString()), row("out", new Date(boundary - 1).toISOString()), row("today", "2026-10-25T12:00:00Z")];
    const stats = periodStatistics(records, { period, today: "2026-10-25", offset: 2 });
    assert.deepEqual(stats.rows.map(r => r._id), ["in", "today"]);
    assert.equal(stats.monthly, true);
    assert.equal(stats.buckets.reduce((sum, b) => sum + b.total, 0), 180);
  }
});
