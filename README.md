# Shiftboard — monthly roster demo

A small, standalone scheduling feature built as a public portfolio sample. It shows how an interactive roster can combine fast shift assignment, a cross-month dependency rule, coverage feedback, and a polished responsive UI.

**[Open the live demo](https://bouzoukisgiannisit.github.io/shiftboard-demo/)**

This repository contains **only a fictional demo**. It has no connection to a real scheduling system, database, authentication service, employee records, or API.

## Features

- Drag a shift from the palette to a calendar cell, or choose a shift and click the cell. The click option works on touch devices and with a keyboard.
- Assigning **N** (night) automatically reserves **R** (rest) on the next day, including the first day of a new month.
- Conflicting assignments are stopped before they overwrite an existing duty.
- Daily coverage is summarized using one morning and one evening shift as a sample rule.
- Undo and redo changes, navigate months, export the current month as CSV, and reset the fictional sample.
- Edits are saved in this browser's `localStorage` only.

## Run locally

Install [Node.js 20 or newer](https://nodejs.org/) and run:

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. There are no npm dependencies or build steps. Run the rule tests with:

```bash
npm test
```

## GitHub Pages

The live demo is published from the `main` branch and `/ (root)` directory. It uses relative paths and needs no build step. The `.nojekyll` file is included for direct static serving.

## Scope and structure

| File | Purpose |
| --- | --- |
| `index.html` | Accessible page structure |
| `src/styles.css` | Responsive visual design |
| `src/app.js` | Browser interactions and rendering |
| `src/planner.js` | Pure scheduling rules |
| `test/planner.test.js` | Rule and boundary tests |
| `scripts/serve.mjs` | Dependency-free local web server |

The roster uses five invented names. It is a focused code sample, not a production scheduling service. CSV export is intended for demonstration and has no integration with a production Excel importer.

## Ελληνικά

Αυτό είναι ανεξάρτητο δείγμα για δημόσιο portfolio. Εκτέλεσε `npm run dev` και άνοιξε `http://127.0.0.1:4173`. Δεν περιέχει πραγματικούς εργαζομένους, δεδομένα ή σύνδεση με την αρχική ιδιωτική εφαρμογή.
