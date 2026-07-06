// ---------------------------------------------------------------------------
// SIMULATED evidence layer.
//
// This module fabricates *illustrative* evidence metadata (claim type,
// confidence, source reference, gap state) to make the intended pipeline
// visible: applicability -> checklist -> evidence submitted -> evidence
// classified/extracted -> gaps assessed -> threshold check.
//
// It is a MOCK, exactly like the RAG Agent "mock supplier evidence" in the
// reference prototype. No OCR/NLP/document extraction happens anywhere. The
// only real ground truth is:
//   - suppliers.json  : whether a value is present (Explicit) or empty (Absent)
//   - metrics.json    : threshold bands + the expected-evidence string
//   - the applicability engine : the Not Applicable determination (reused, not
//                                recomputed)
// Confidence and source references are derived deterministically (by hashing
// field + supplier id) purely so the demo is stable and looks natural. They do
// NOT reflect any real assessment of evidence quality and must always be
// labelled as illustrative in the UI.
// ---------------------------------------------------------------------------

import type { ApplicabilityStatus, DFCode, EvaluationResult, FactorApplicability } from './types'
import metrics from '../data/metrics.json'

export const SIM_NOTE =
  'Simulated evidence layer — claim type, confidence and source references are illustrative for this prototype. ' +
  'No real document extraction (OCR/NLP) is performed; the underlying supplier values and scoring are unchanged.'

export type EvidenceSourceType = 'Request from supplier' | 'Buyer records' | 'Public records'
export type ClaimType = 'Explicit' | 'Absent'
export type GapState = 'Covered' | 'Weak' | 'Missing' | 'Null'

export interface EvidenceMeta {
  claimType: ClaimType
  confidence: number | null // null when claim type is Absent
  sourceType: EvidenceSourceType
  sourceRef: string
  gapState: GapState
  dataState: string // simulated sourcing state label (Submitted / Buyer-held / Public / Restricted / Deferred / Missing)
}

// --- Source-type classification (per the fixed rule in the brief) -----------
const PUBLIC_FIELDS = new Set([
  'credit_risk_rating',
  'trade_compliance_screening_status',
  'geopolitical_risk_level',
  'ownership_stability_status',
])
const BUYER_FIELDS = new Set([
  'on_time_delivery_pct',
  'quality_ppm',
  'capa_closure_rate_pct',
  'schedule_adherence_pct',
])

export function sourceTypeFor(field: string): EvidenceSourceType {
  if (PUBLIC_FIELDS.has(field)) return 'Public records'
  if (BUYER_FIELDS.has(field)) return 'Buyer records'
  return 'Request from supplier'
}

// --- Deterministic hashing (FNV-1a) -> stable, natural-looking variation ----
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function unit(str: string): number {
  return (hash(str) % 100000) / 100000 // 0..1
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isAbsent(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

// --- Mock source-reference strings (vary by factor group) -------------------
const PUBLIC_REF: Record<string, string> = {
  credit_risk_rating: 'Credit bureau report',
  trade_compliance_screening_status: 'Trade screening database',
  geopolitical_risk_level: 'Country risk index',
  ownership_stability_status: 'Corporate registry filing',
}
const SUPPLIER_DOC: Record<DFCode, string> = {
  DF1: 'Capability statement',
  DF2: 'Capacity & ramp plan',
  DF3: 'PPAP Section 9',
  DF4: 'Logistics capability pack',
  DF5: 'Audited financial statements',
  DF6: 'Compliance attestation pack',
  DF7: 'Business continuity dossier',
}

function sourceRefFor(field: string, df: DFCode, key: string): string {
  const st = sourceTypeFor(field)
  if (st === 'Public records') return PUBLIC_REF[field] ?? 'Public registry record'
  if (st === 'Buyer records') {
    return field === 'on_time_delivery_pct' || field === 'schedule_adherence_pct'
      ? 'Buyer ERP delivery record'
      : 'Buyer QMS export'
  }
  const doc = SUPPLIER_DOC[df] ?? 'Supplier submission'
  const page = 1 + (hash('pg|' + key) % 24)
  return `${doc}, p.${page}`
}

// --- Core: fabricate evidence metadata for one supplier x factor cell -------
export function evidenceMeta(
  field: string,
  supplierId: string,
  value: unknown,
  applicability: ApplicabilityStatus,
  df: DFCode,
): EvidenceMeta {
  const sourceType = sourceTypeFor(field)

  if (isAbsent(value)) {
    return {
      claimType: 'Absent',
      confidence: null,
      sourceType,
      sourceRef: '—',
      // A Not Applicable factor is Null (out of scope), otherwise a real Missing gap.
      gapState: applicability === 'Not Applicable' ? 'Null' : 'Missing',
      dataState: 'Missing',
    }
  }

  // Present -> Explicit claim. Derive a simulated sourcing state deterministically.
  const key = field + '|' + supplierId
  const band = unit('band|' + key)
  const vary = unit('var|' + key)

  let confidence: number
  let dataState: string
  if (band < 0.18) {
    // A minority of items simulate restricted/deferred sourcing (weaker attribution).
    confidence = round2(0.45 + vary * 0.1) // 0.45–0.55
    dataState = vary < 0.5 ? 'Restricted' : 'Deferred'
  } else {
    confidence = round2(0.85 + vary * 0.1) // 0.85–0.95
    dataState =
      sourceType === 'Public records' ? 'Public' : sourceType === 'Buyer records' ? 'Buyer-held' : 'Submitted'
  }

  let gapState: GapState
  if (applicability === 'Not Applicable') gapState = 'Null'
  else if (confidence >= 0.7) gapState = 'Covered'
  else gapState = 'Weak'

  return {
    claimType: 'Explicit',
    confidence,
    sourceType,
    sourceRef: sourceRefFor(field, df, key),
    gapState,
    dataState,
  }
}

// --- Checklist "why it matters" (derived from existing threshold bands) ------
// There is no separate definition dataset in this repo, so the one-line
// rationale is derived factually from the metric's own band configuration.
export function whyItMatters(field: string): string {
  const m = (metrics as Record<string, any>)[field]
  if (!m) return 'Contributes to the decision-factor readiness roll-up.'
  const showUnit = m.unit && !['status', 'level', 'rating', 'date'].includes(m.unit)
  const u = showUnit ? ' ' + m.unit : ''
  const num = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString() : String(n))
  if (m.type === 'numeric') {
    if (m.relativeTo) return `Must cover demand — pass ≥ ${m.pass}× ${String(m.relativeTo).replace(/_/g, ' ')}.`
    if (m.direction === 'gte') return `Higher is better — pass ≥ ${num(m.pass)}${u}, watch ≥ ${num(m.watch)}${u}.`
    return `Lower is better — pass ≤ ${num(m.pass)}${u}, watch ≤ ${num(m.watch)}${u}.`
  }
  if (m.type === 'date') return `Certificate must stay valid at least ${m.bufferDays} days past the evaluation date.`
  if (m.type === 'enum') {
    const pass = (m.passSet || []).join(', ')
    return `Acceptable states: ${pass}${m.criticalFlagRule ? ' — a failing state raises a critical flag.' : '.'}`
  }
  return 'Contributes to the decision-factor readiness roll-up.'
}

// Expected-evidence examples: reuse the existing metrics `evidence` string,
// split on "/" into up to three illustrative examples (no fabrication).
export function expectedEvidenceExamples(field: string): string[] {
  const raw = (metrics as Record<string, any>)[field]?.evidence ?? 'Supporting documentation'
  const parts = String(raw)
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.slice(0, 3)
}

// --- Checklist builder (Mandatory + Conditional Active only) ----------------
export interface ChecklistItem {
  code: string
  name: string
  field: string
  applicability: ApplicabilityStatus
  why: string
  evidence: string[]
}
export interface ChecklistGroup {
  sourceType: EvidenceSourceType
  items: ChecklistItem[]
}

export function buildChecklist(app: FactorApplicability[]): ChecklistGroup[] {
  const inScope = app.filter((a) => a.status === 'Mandatory' || a.status === 'Conditional Active')
  const order: EvidenceSourceType[] = ['Request from supplier', 'Buyer records', 'Public records']
  return order
    .map((st) => ({
      sourceType: st,
      items: inScope
        .filter((a) => sourceTypeFor(a.field) === st)
        .map((a) => ({
          code: a.code,
          name: a.name,
          field: a.field,
          applicability: a.status,
          why: whyItMatters(a.field),
          evidence: expectedEvidenceExamples(a.field),
        })),
    }))
    .filter((g) => g.items.length > 0)
}

// --- Gap register builder (Weak + Missing across all suppliers) -------------
export interface GapRow {
  supplierId: string
  supplierName: string
  code: string
  name: string
  field: string
  df: DFCode
  applicability: ApplicabilityStatus
  gapState: 'Weak' | 'Missing'
  confidence: number | null
  action: string
}

function appRank(a: ApplicabilityStatus): number {
  if (a === 'Mandatory') return 0
  if (a === 'Conditional Active') return 1
  if (a === 'Optional') return 2
  return 3
}

export function buildGapRegister(result: EvaluationResult): GapRow[] {
  const rows: GapRow[] = []
  for (const s of result.suppliers) {
    for (const f of s.factors) {
      const meta = evidenceMeta(f.field, s.id, f.value, f.applicability, f.df)
      if (meta.gapState === 'Weak' || meta.gapState === 'Missing') {
        rows.push({
          supplierId: s.id,
          supplierName: s.name,
          code: f.code,
          name: f.name,
          field: f.field,
          df: f.df,
          applicability: f.applicability,
          gapState: meta.gapState,
          confidence: meta.confidence,
          action:
            meta.gapState === 'Missing'
              ? `Request evidence for ${f.name}`
              : `Request stronger evidence / follow up on ${f.name}`,
        })
      }
    }
  }
  rows.sort(
    (x, y) =>
      appRank(x.applicability) - appRank(y.applicability) ||
      (x.gapState === y.gapState ? 0 : x.gapState === 'Missing' ? -1 : 1) ||
      x.code.localeCompare(y.code),
  )
  return rows
}

// Map a gap state to the existing status-pill palette classes.
export function gapPillClass(g: GapState): string {
  switch (g) {
    case 'Covered':
      return 'pass'
    case 'Weak':
      return 'watch'
    case 'Missing':
      return 'below'
    default:
      return 'na'
  }
}
