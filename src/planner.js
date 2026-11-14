export const SHIFTS = Object.freeze([
  { code: "M", name: "Morning", time: "07:00–15:00", kind: "work" },
  { code: "E", name: "Evening", time: "15:00–23:00", kind: "work" },
  { code: "N", name: "Night", time: "23:00–07:00", kind: "work" },
  { code: "R", name: "Rest", time: "After night duty", kind: "rest" },
  { code: "O", name: "Day off", time: "No assignment", kind: "rest" },
]);

const VALID_CODES = new Set(SHIFTS.map(shift => shift.code));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function dateKey(year, monthIndex, day) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    throw new TypeError("A year, month and day are required.");
  }
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  if (!DATE_PATTERN.test(date) || !Number.isInteger(days)) throw new TypeError("Invalid date.");
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw new TypeError("Invalid date.");
  }
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthDates(year, monthIndex) {
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => dateKey(year, monthIndex, index + 1));
}

export function cellKey(employeeId, date) {
  return `${employeeId}|${date}`;
}

export function applyShift(entries, employeeId, date, code) {
  if (!employeeId || !DATE_PATTERN.test(date) || (code !== null && !VALID_CODES.has(code))) {
    return { ok: false, entries, message: "Invalid assignment." };
  }
  try { addDays(date, 0); } catch { return { ok: false, entries, message: "Invalid date." }; }

  const targetKey = cellKey(employeeId, date);
  const current = entries[targetKey];
  if (current?.generatedBy) {
    return { ok: false, entries,
      message: `This rest day follows a night shift on ${current.generatedBy}. Change that night shift first.` };
  }

  const followingKey = cellKey(employeeId, addDays(date, 1));
  const following = entries[followingKey];
  if (code === "N" && following && following.code !== "R") {
    return { ok: false, entries,
      message: "The next day already has a shift. Clear it before assigning a night shift." };
  }

  const next = { ...entries };
  if (current?.code === "N" && following?.generatedBy === date) delete next[followingKey];
  if (code === null) delete next[targetKey];
  else next[targetKey] = { code };

  if (code === "N") next[followingKey] = { code: "R", generatedBy: date };
  return { ok: true, entries: next,
    message: code === "N" ? "Night duty added. The next day is reserved for rest."
      : code === null ? "Assignment cleared." : `${SHIFTS.find(shift => shift.code === code).name} assigned.` };
}

export function coverage(entries, employeeIds, date) {
  const counts = { M: 0, E: 0, N: 0 };
  for (const id of employeeIds) {
    const code = entries[cellKey(id, date)]?.code;
    if (code in counts) counts[code] += 1;
  }
  return { ...counts, complete: counts.M > 0 && counts.E > 0 };
}

export function sanitizeSavedEntries(value, employeeIds) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(employeeIds.map(String));
  const entries = {};
  for (const [key, item] of Object.entries(value)) {
    const [employeeId, date] = key.split("|");
    if (!allowed.has(employeeId) || !DATE_PATTERN.test(date) || !VALID_CODES.has(item?.code)) continue;
    try { addDays(date, 0); } catch { continue; }
    if (item.generatedBy) {
      if (item.code !== "R" || typeof item.generatedBy !== "string") continue;
      try { if (addDays(item.generatedBy, 1) !== date) continue; } catch { continue; }
    }
    entries[key] = item.generatedBy ? { code: "R", generatedBy: item.generatedBy } : { code: item.code };
  }
  for (const [key, item] of Object.entries(entries)) {
    if (item.generatedBy && entries[cellKey(key.split("|")[0], item.generatedBy)]?.code !== "N") {
      delete entries[key];
    }
  }
  return entries;
}

export function sampleEntries(year, monthIndex, employees) {
  let entries = {};
  const examples = [
    [0, 1, "M"], [0, 3, "N"], [1, 1, "E"], [1, 2, "M"],
    [2, 2, "M"], [2, 4, "E"], [3, 3, "E"], [3, 5, "M"], [4, 1, "M"],
  ];
  for (const [employeeIndex, day, code] of examples) {
    if (!employees[employeeIndex]) continue;
    const result = applyShift(entries, employees[employeeIndex].id, dateKey(year, monthIndex, day), code);
    if (result.ok) entries = result.entries;
  }
  return entries;
}
