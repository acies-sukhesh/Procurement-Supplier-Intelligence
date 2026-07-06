# Supplier Evaluation Engine

A local, config-driven prototype for manufacturing procurement. A manufacturer configures an
evaluation request (part + sourcing strategy); the engine derives which of **43 leaf factors**
(grouped under **7 decision factors**) apply, validates five sample suppliers' evidence against
them, scores each applicable factor, aggregates to a readiness result, and produces a
**comparative supplier readiness recommendation** — never a final approval or rejection.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

React + TypeScript + Vite, charting with Recharts. No backend, database, or authentication —
everything runs from local JSON configuration loaded into React state.

## How it works

- **Applicability** (`src/engine/applicability.ts`) — fixed rule precedence per factor:
  Not Applicable → Mandatory → Conditional → Default, then Criticality and Strategy upgrades.
  Every factor carries an ordered reason trace.
- **Validation** (`src/engine/validation.ts`) — presence and format checks first, then threshold
  banding into Pass / Watch / Below Threshold / Missing / Invalid, with conditional critical
  flags that fire only when their request-context trigger is active.
- **Aggregation** (`src/engine/evaluate.ts`) — status → score, averaged per decision factor,
  weighted by the sourcing strategy into a readiness percentage, with a mandatory-floor gate and
  a relative TOPSIS ranking across the five suppliers.

## Configuration

All framework content is data, editable without touching engine code:

| File | Contents |
|---|---|
| `src/data/leafFactors.json` | The 43 leaf factors and their canonical fields |
| `src/data/applicabilityRules.json` | Per-factor applicability predicates and reason text |
| `src/data/metrics.json` | Threshold bands, evidence, and critical-flag rules per field |
| `src/data/strategies.json` | Decision-factor weight presets and mandatory floors |
| `src/data/scoringConfig.json` | Status-to-score map and readiness label bands |
| `src/data/suppliers.json` | The five sample suppliers' evidence values |

## Screens

Set up (Evaluation Request, Rules & Applicability) · Reference (Metric Dictionary, Supplier
Data) · Evaluate (Validation, Aggregation & Readiness, Supplier Comparison) · Explore (Scenario
Impact, Prototype Summary). Sidebar badges update live from engine state.

Thresholds marked *provisional* in the Metric Dictionary follow the representative bands in the
specification and are intended for review before any operational use.
