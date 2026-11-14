import { SHIFTS, addDays, applyShift, cellKey, coverage, monthDates, sampleEntries,
  sanitizeSavedEntries } from "./planner.js";

const EMPLOYEES = Object.freeze([
  { id: "alex", name: "Alex Morgan", initials: "AM", color: "mint" },
  { id: "sam", name: "Sam Reed", initials: "SR", color: "blue" },
  { id: "maya", name: "Maya Chen", initials: "MC", color: "amber" },
  { id: "theo", name: "Theo Hart", initials: "TH", color: "violet" },
  { id: "lina", name: "Lina Park", initials: "LP", color: "rose" },
]);
const STORAGE_KEY = "shiftboard-demo-v1";
const now = new Date();
const state = {
  year: now.getFullYear(), month: now.getMonth(), selected: "M", focusedDate: null,
  entries: {}, undo: [], redo: [],
};
const $ = id => document.getElementById(id);

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: state.entries })); }
  catch { showStatus("Browser storage is unavailable; changes will last until this tab closes.", true); }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1) return sanitizeSavedEntries(saved.entries, EMPLOYEES.map(item => item.id));
  } catch { /* Start from the public sample if storage is unavailable or invalid. */ }
  return sampleEntries(state.year, state.month, EMPLOYEES);
}

function showStatus(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

function dateLabel(date, options) {
  return new Intl.DateTimeFormat("en", { timeZone: "UTC", ...options })
    .format(new Date(`${date}T00:00:00Z`));
}

function renderPalette() {
  $("palette").innerHTML = `${SHIFTS.map(shift => `<button type="button" draggable="true"
    class="shift-chip ${shift.code === state.selected ? "selected" : ""}" data-shift="${shift.code}"
    aria-pressed="${shift.code === state.selected}" title="${shift.name} · ${shift.time}"><b class="shift-code shift-${shift.code}">${shift.code}</b><span>${shift.name}<small>${shift.time}</small></span></button>`).join("")}
    <button type="button" draggable="true" class="shift-chip clear-chip ${state.selected === "CLEAR" ? "selected" : ""}"
      data-shift="CLEAR" aria-pressed="${state.selected === "CLEAR"}"><b class="shift-code">×</b><span>Clear<small>Remove assignment</small></span></button>`;
}

function renderCoverage(date) {
  const counts = coverage(state.entries, EMPLOYEES.map(item => item.id), date);
  $("coverageTitle").textContent = dateLabel(date, { weekday: "long", day: "numeric", month: "long" });
  $("coverageDetails").innerHTML = `<div class="coverage-row"><span>Morning</span><strong>${counts.M}</strong></div>
    <div class="coverage-row"><span>Evening</span><strong>${counts.E}</strong></div>
    <div class="coverage-row"><span>Night</span><strong>${counts.N}</strong></div>
    <p class="coverage-result ${counts.complete ? "covered" : "needs-cover"}">${counts.complete ? "✓ Minimum coverage met" : "! Morning or evening coverage needed"}</p>`;
}

function render() {
  const dates = monthDates(state.year, state.month);
  if (!state.focusedDate || !dates.includes(state.focusedDate)) state.focusedDate = dates[0];
  const scroll = $("gridScroll");
  const previousScroll = scroll.scrollLeft;
  $("monthTitle").textContent = dateLabel(dates[0], { month: "long", year: "numeric" });
  $("employeeCount").textContent = EMPLOYEES.length;
  let working = 0;
  let nights = 0;
  for (const employee of EMPLOYEES) for (const date of dates) {
    const code = state.entries[cellKey(employee.id, date)]?.code;
    if (["M", "E", "N"].includes(code)) working++;
    if (code === "N") nights++;
  }
  const gaps = dates.filter(date => !coverage(state.entries, EMPLOYEES.map(item => item.id), date).complete).length;
  $("workingCount").textContent = working;
  $("nightCount").textContent = nights;
  $("gapCount").textContent = gaps;
  $("undo").disabled = !state.undo.length;
  $("redo").disabled = !state.redo.length;

  $("rosterGrid").innerHTML = `<thead><tr><th scope="col" class="name-col">Team member</th>${dates.map(date => {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = day === 0 || day === 6;
    const gap = !coverage(state.entries, EMPLOYEES.map(item => item.id), date).complete;
    return `<th scope="col" class="date-col ${weekend ? "weekend" : ""} ${gap ? "gap-day" : ""} ${date === state.focusedDate ? "focused-day" : ""}" title="${gap ? "Coverage gap" : "Coverage met"}"><small>${dateLabel(date, { weekday: "short" })}</small><b>${Number(date.slice(-2))}</b></th>`;
  }).join("")}</tr></thead><tbody>${EMPLOYEES.map(employee => `<tr><th scope="row" class="name-col"><span class="person"><span class="avatar ${employee.color}">${employee.initials}</span><span>${employee.name}<small>Team member</small></span></span></th>${dates.map(date => {
    const item = state.entries[cellKey(employee.id, date)];
    const label = item ? SHIFTS.find(shift => shift.code === item.code).name : "Empty";
    const locked = Boolean(item?.generatedBy);
    return `<td><button type="button" class="roster-cell ${item ? `cell-${item.code}` : "empty"} ${locked ? "generated" : ""}"
      data-cell data-employee="${employee.id}" data-date="${date}" aria-label="${employee.name}, ${date}: ${label}${locked ? ", automatic after night duty" : ""}"
      title="${locked ? `Automatic rest after ${item.generatedBy}` : `${employee.name} · ${date} · ${label}`}"
      ${locked ? "aria-disabled=\"true\"" : ""}><b>${item?.code || "+"}</b>${locked ? "<small>AUTO</small>" : ""}</button></td>`;
  }).join("")}</tr>`).join("")}</tbody>`;
  scroll.scrollLeft = previousScroll;
  renderPalette();
  renderCoverage(state.focusedDate);
}

function assign(employeeId, date, code) {
  state.focusedDate = date;
  const result = applyShift(state.entries, employeeId, date, code === "CLEAR" ? null : code);
  if (!result.ok) { renderCoverage(date); showStatus(result.message, true); return; }
  state.undo.push(state.entries);
  if (state.undo.length > 40) state.undo.shift();
  state.redo = [];
  state.entries = result.entries;
  save(); render(); showStatus(result.message);
}

function travel(direction) {
  const source = direction === "undo" ? state.undo : state.redo;
  const destination = direction === "undo" ? state.redo : state.undo;
  if (!source.length) return;
  destination.push(state.entries);
  state.entries = source.pop();
  save(); render(); showStatus(direction === "undo" ? "Last change undone." : "Change restored.");
}

function moveMonth(offset) {
  const date = new Date(state.year, state.month + offset, 1);
  state.year = date.getFullYear(); state.month = date.getMonth(); state.focusedDate = null;
  render();
}

function exportCsv() {
  const dates = monthDates(state.year, state.month);
  const cells = [["Team member", ...dates], ...EMPLOYEES.map(employee => [employee.name,
    ...dates.map(date => state.entries[cellKey(employee.id, date)]?.code || "")])];
  const csv = cells.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shiftboard-${state.year}-${String(state.month + 1).padStart(2, "0")}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus("CSV downloaded for the displayed month.");
}

$("palette").addEventListener("click", event => {
  const button = event.target.closest("[data-shift]");
  if (!button) return;
  state.selected = button.dataset.shift;
  renderPalette(); showStatus("Shift selected. Click a roster cell or drag the chip onto it.");
});
$("palette").addEventListener("dragstart", event => {
  const button = event.target.closest("[data-shift]");
  if (!button) return;
  event.dataTransfer.setData("text/plain", button.dataset.shift);
  event.dataTransfer.effectAllowed = "copy";
});
$("gridScroll").addEventListener("click", event => {
  const button = event.target.closest("[data-cell]");
  if (button) assign(button.dataset.employee, button.dataset.date, state.selected);
});
$("gridScroll").addEventListener("dragover", event => {
  const button = event.target.closest("[data-cell]");
  if (!button) return;
  event.preventDefault(); event.dataTransfer.dropEffect = "copy";
  document.querySelectorAll(".roster-cell.drag-over").forEach(item => item.classList.remove("drag-over"));
  button.classList.add("drag-over");
});
$("gridScroll").addEventListener("dragleave", event => {
  event.target.closest("[data-cell]")?.classList.remove("drag-over");
});
$("gridScroll").addEventListener("drop", event => {
  const button = event.target.closest("[data-cell]");
  if (!button) return;
  event.preventDefault();
  button.classList.remove("drag-over");
  const code = event.dataTransfer.getData("text/plain");
  if (code) assign(button.dataset.employee, button.dataset.date, code);
});
$("previousMonth").addEventListener("click", () => moveMonth(-1));
$("nextMonth").addEventListener("click", () => moveMonth(1));
$("today").addEventListener("click", () => { state.year = now.getFullYear(); state.month = now.getMonth(); state.focusedDate = null; render(); });
$("undo").addEventListener("click", () => travel("undo"));
$("redo").addEventListener("click", () => travel("redo"));
$("export").addEventListener("click", exportCsv);
$("reset").addEventListener("click", () => {
  if (!window.confirm("Replace your local edits with the fictional sample roster?")) return;
  state.undo.push(state.entries); state.redo = [];
  state.entries = sampleEntries(state.year, state.month, EMPLOYEES);
  save(); render(); showStatus("Sample roster restored.");
});
document.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  if (event.key.toLowerCase() === "z") { event.preventDefault(); travel(event.shiftKey ? "redo" : "undo"); }
  if (event.key.toLowerCase() === "y") { event.preventDefault(); travel("redo"); }
});

state.entries = load();
render();
