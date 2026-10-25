import test from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, nextThemeChange } from "../src/theme.js";
const date = (h, m = 0, s = 0) => new Date(2026, 9, 25, h, m, s);
test("automatic theme switches exactly at local 07:00 and 21:00", () => {
  for (const [h, m, s, expected] of [
    [0, 0, 0, "night"],
    [6, 59, 59, "night"],
    [7, 0, 0, "day"],
    [20, 59, 59, "day"],
    [21, 0, 0, "night"],
    [23, 59, 59, "night"],
  ])
    assert.equal(resolveTheme("auto", date(h, m, s)), expected);
});
test("manual choice overrides the automatic schedule", () => {
  for (const h of [0, 7, 12, 21, 23]) {
    assert.equal(resolveTheme("day", date(h)), "day");
    assert.equal(resolveTheme("night", date(h)), "night");
  }
});
test("next change follows local calendar, including month/year rollover", () => {
  assert.equal(+nextThemeChange(date(6, 59, 59)), +date(7));
  assert.equal(+nextThemeChange(date(7)), +date(21));
  assert.equal(+nextThemeChange(date(20, 59, 59)), +date(21));
  assert.equal(+nextThemeChange(date(21)), +new Date(2026, 9, 26, 7));
  assert.equal(
    +nextThemeChange(new Date(2026, 11, 31, 23)),
    +new Date(2027, 0, 1, 7),
  );
});
