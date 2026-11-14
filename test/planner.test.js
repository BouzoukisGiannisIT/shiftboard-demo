import test from "node:test";
import assert from "node:assert/strict";
import { addDays, applyShift, cellKey, coverage, monthDates, sanitizeSavedEntries } from "../src/planner.js";

test("a night shift reserves next-day rest across a month boundary", () => {
  const result = applyShift({}, "alex", "2026-11-30", "N");
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries[cellKey("alex", "2026-12-01")], { code: "R", generatedBy: "2026-11-30" });
  assert.equal(applyShift(result.entries, "alex", "2026-12-01", "M").ok, false);
});

test("a night shift does not overwrite an existing next-day duty", () => {
  const first = applyShift({}, "alex", "2026-11-07", "M");
  const result = applyShift(first.entries, "alex", "2026-11-06", "N");
  assert.equal(result.ok, false);
  assert.deepEqual(result.entries, first.entries);
});

test("changing night duty releases only the rest that it generated", () => {
  const night = applyShift({}, "alex", "2026-11-06", "N");
  const changed = applyShift(night.entries, "alex", "2026-11-06", "E");
  assert.equal(changed.ok, true);
  assert.equal(changed.entries[cellKey("alex", "2026-11-07")], undefined);
});

test("an existing manually entered rest becomes tied to a new night duty", () => {
  const rest = applyShift({}, "alex", "2026-11-07", "R");
  const night = applyShift(rest.entries, "alex", "2026-11-06", "N");
  assert.deepEqual(night.entries[cellKey("alex", "2026-11-07")], { code: "R", generatedBy: "2026-11-06" });
});

test("coverage counts working assignments for a day", () => {
  let entries = applyShift({}, "alex", "2026-11-02", "M").entries;
  entries = applyShift(entries, "sam", "2026-11-02", "E").entries;
  assert.deepEqual(coverage(entries, ["alex", "sam"], "2026-11-02"), { M: 1, E: 1, N: 0, complete: true });
});

test("saved data rejects unknown people, invalid dates and orphan automatic rest", () => {
  const saved = {
    "alex|2026-11-06": { code: "M" },
    "other|2026-11-06": { code: "N" },
    "alex|2026-11-31": { code: "M" },
    "alex|2026-11-07": { code: "R", generatedBy: "2026-11-06" },
  };
  assert.deepEqual(sanitizeSavedEntries(saved, ["alex"]), { "alex|2026-11-06": { code: "M" } });
});

test("calendar dates follow leap years and year boundaries", () => {
  assert.equal(monthDates(2028, 1).length, 29);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
