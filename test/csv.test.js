import test from "node:test";
import assert from "node:assert/strict";
import { exportCsv, parseCsv } from "../src/csv.js";
const r = {
  _id: "test-id",
  childId: "child-1",
  offeredMl: 120,
  consumedMl: 100,
  spitUp: true,
  fedAt: "2026-10-24T12:00:00.000Z",
};
test("CSV roundtrip supports Ukrainian, quotes, commas, newlines and neutralises spreadsheet formulas", () => {
  for (const name of [
    "Лука",
    'Леон, "лев"',
    "Малюк\nНовий рядок",
    '=HYPERLINK("bad")',
    "+SUM(A1)",
    "-1",
    "@evil",
    "'=original",
    "''quoted",
  ]) {
    const csv = exportCsv([r], [{ id: r.childId, name }]);
    assert.deepEqual(parseCsv(csv), [
      {
        sourceId: r._id,
        sourceChildId: r.childId,
        childName: name,
        offeredMl: 120,
        consumedMl: 100,
        spitUp: true,
        fedAt: r.fedAt,
      },
    ]);
    if (/^[=+@-]/.test(name)) assert.ok(csv.includes("\"'"));
  }
});
test("CSV rejects incompatible headers, duplicate IDs, invalid amounts, boolean, timestamps and malformed quotes", () => {
  const good = exportCsv([r], [{ id: r.childId, name: "Лука" }]);
  for (const value of [
    good.replace("offeredMl", "volume"),
    good + "\r\n" + good.split("\r\n")[1],
    good.replace('"100"', '"999"'),
    good.replace('"true"', '"yes"'),
    good.replace('"2026-10-24T12:00:00.000Z"', '"2026-10-24T12:00"'),
    good + '"',
  ])
    assert.throws(() => parseCsv(value));
});
