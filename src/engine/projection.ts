// ---------------------------------------------------------------------------
// Hypothetical "what-if" readiness projection.
//
// Display/calculation only. This module NEVER mutates the real evaluation: it
// re-runs the exact existing `evaluate(context, overrides)` pipeline with one or
// more supplier inputs swapped for a value that scores Pass, and reads back the
// real DF-score / Readiness / label the engine already computes. No new scoring
// formula is introduced here — the overrides path is the same one the accepted
// AI-claims feature uses. Callers layer these projections on top of whatever
// overrides are already live (e.g. pushedClaims) so the "before" matches the
// currently displayed score.
// ---------------------------------------------------------------------------

import { evaluate } from './evaluate'
import metrics from '../data/metrics.json'
import type {
  ApplicabilityStatus,
  DFCode,
  ReadinessLabel,
  RequestContext,
  SupplierResult,
} from './types'

interface MetricDef {
  type: 'numeric' | 'enum' | 'date'
  direction: 'gte' | 'lte' | 'enum' | 'date'
  pass?: number
  watch?: number
  relativeTo?: string
  passSet?: string[]
  bufferDays?: number
}
const metricDefs = metrics as unknown as Record<string, MetricDef>

// Derives an input value guaranteed to validate as Pass for a given field,
// straight from the existing metric band configuration. Note: for a numeric
// field with a `relativeTo` basis or a `dependency`, the returned value is the
// pass threshold and assumes the related field is not itself the binding
// constraint — true for the current dataset's projectable factors.
export function passingValueFor(field: string, ctx: RequestContext): unknown {
  const def = metricDefs[field]
  if (!def) return undefined
  if (def.type === 'enum') return def.passSet?.[0]
  if (def.type === 'date') {
    const buffer = def.bufferDays ?? 30
    const base = new Date(ctx.eval_date)
    base.setDate(base.getDate() + buffer + 1)
    return base.toISOString().slice(0, 10)
  }
  // numeric
  const basis = def.relativeTo ? Number((ctx as unknown as Record<string, number>)[def.relativeTo]) || 0 : 1
  return (def.pass ?? 0) * (def.relativeTo ? basis : 1)
}

export interface ProjectionStep {
  code: string
  name: string
  df: DFCode
  applicability: ApplicabilityStatus
  readinessAfter: number // cumulative readiness once this and all prior steps are provided
  delta: number // incremental gain vs the previous step
}

export interface CriticalItem {
  code: string
  name: string
  df: DFCode
  status: string // the current (failing/absent) validation status
  readinessAfter: number // readiness if this single item is resolved to Pass
  delta: number
  labelAfter: ReadinessLabel
  clearsOverrideAlone: boolean // true if resolving just this item removes the critical-flag override
}

export interface SupplierProjection {
  readinessNow: number
  labelNow: ReadinessLabel
  // Section A — Missing Mandatory / Conditional-Active factors (cumulative ladder).
  missing: ProjectionStep[]
  readinessAfterAllMissing: number
  // Section B — factors currently firing a Critical Flag.
  critical: CriticalItem[]
  readinessAfterAllCritical: number
  labelAfterAllCritical: ReadinessLabel
}

// Builds both what-if sections for one supplier, reusing the live overrides as
// the baseline so "before" equals the currently displayed score.
export function buildSupplierProjection(
  context: RequestContext,
  baseOverrides: Record<string, Record<string, unknown>>,
  supplier: SupplierResult,
): SupplierProjection {
  const sid = supplier.id
  const baseForSupplier = baseOverrides[sid] ?? {}

  const evalSupplier = (extra: Record<string, unknown>): SupplierResult => {
    const merged = { ...baseOverrides, [sid]: { ...baseForSupplier, ...extra } }
    return evaluate(context, merged).suppliers.find((s) => s.id === sid)!
  }

  // --- Section A: applicable factors with no data (status Missing) -----------
  const missingFactors = supplier.factors.filter(
    (f) => f.status === 'Missing' && (f.applicability === 'Mandatory' || f.applicability === 'Conditional Active'),
  )
  // Order by individual uplift (descending) so the ladder reads as a clear climb.
  const ranked = missingFactors
    .map((f) => ({ f, indiv: evalSupplier({ [f.field]: passingValueFor(f.field, context) }).readiness - supplier.readiness }))
    .sort((a, b) => b.indiv - a.indiv)

  const missing: ProjectionStep[] = []
  let acc: Record<string, unknown> = {}
  let prev = supplier.readiness
  for (const { f } of ranked) {
    acc = { ...acc, [f.field]: passingValueFor(f.field, context) }
    const after = evalSupplier(acc)
    missing.push({
      code: f.code,
      name: f.name,
      df: f.df,
      applicability: f.applicability,
      readinessAfter: after.readiness,
      delta: after.readiness - prev,
    })
    prev = after.readiness
  }

  // --- Section B: factors currently firing a Critical Flag -------------------
  const critFactors = supplier.factors.filter((f) => f.status === 'Critical Flag')
  const critical: CriticalItem[] = critFactors.map((f) => {
    const after = evalSupplier({ [f.field]: passingValueFor(f.field, context) })
    return {
      code: f.code,
      name: f.name,
      df: f.df,
      status: f.status,
      readinessAfter: after.readiness,
      delta: after.readiness - supplier.readiness,
      labelAfter: after.label,
      clearsOverrideAlone: after.criticalFlags.length === 0,
    }
  })

  let readinessAfterAllCritical = supplier.readiness
  let labelAfterAllCritical = supplier.label
  if (critFactors.length > 0) {
    const allCrit = Object.fromEntries(critFactors.map((f) => [f.field, passingValueFor(f.field, context)]))
    const after = evalSupplier(allCrit)
    readinessAfterAllCritical = after.readiness
    labelAfterAllCritical = after.label
  }

  return {
    readinessNow: supplier.readiness,
    labelNow: supplier.label,
    missing,
    readinessAfterAllMissing: prev,
    critical,
    readinessAfterAllCritical,
    labelAfterAllCritical,
  }
}

// ---------------------------------------------------------------------------
// "Impact if Skipped" — the inverse of Section A, for the Rules & Applicability
// what-if view. For each in-scope factor it hypothetically removes the evidence
// (overrides the field to blank → the engine scores it Missing/0, the same path
// buildSupplierProjection Section A fills back in) and reads the real readiness
// drop. Note: Optional factors are excluded from the DF denominator by the
// scoring rules, so skipping one is a genuine 0.0-pt change — expected, not a bug.
// ---------------------------------------------------------------------------

export type ImpactBand = 'Critical' | 'High' | 'Medium' | 'Low' | 'None'

export interface SkipImpact {
  code: string
  name: string
  field: string
  df: DFCode
  applicability: ApplicabilityStatus
  readinessAfter: number // supplier readiness if this single factor were skipped
  delta: number // readinessAfter - current readiness (<= 0)
  firesCriticalFlag: boolean // skipping this factor triggers a Critical-Flag label override
  band: ImpactBand
}

// Tunable readiness-point thresholds for the qualitative bands (readiness only —
// never financial/ROI). Critical is decided separately by a critical-flag trigger.
const IMPACT_BANDS = { high: 2, medium: 0.5, low: 0.0001 }

export function buildSkipImpacts(
  context: RequestContext,
  baseOverrides: Record<string, Record<string, unknown>>,
  supplier: SupplierResult,
): SkipImpact[] {
  const sid = supplier.id
  const baseForSupplier = baseOverrides[sid] ?? {}
  const now = supplier.readiness

  const impacts: SkipImpact[] = []
  for (const f of supplier.factors) {
    if (f.applicability === 'Not Applicable') continue
    const merged = { ...baseOverrides, [sid]: { ...baseForSupplier, [f.field]: '' } }
    const after = evaluate(context, merged).suppliers.find((s) => s.id === sid)!
    const af = after.factors.find((x) => x.field === f.field)!
    const firesCriticalFlag = af.status === 'Critical Flag'
    const dropPts = (now - after.readiness) * 100

    let band: ImpactBand
    if (firesCriticalFlag) band = 'Critical'
    else if (dropPts >= IMPACT_BANDS.high) band = 'High'
    else if (dropPts >= IMPACT_BANDS.medium) band = 'Medium'
    else if (dropPts >= IMPACT_BANDS.low) band = 'Low'
    else band = 'None'

    impacts.push({
      code: f.code,
      name: f.name,
      field: f.field,
      df: f.df,
      applicability: f.applicability,
      readinessAfter: after.readiness,
      delta: after.readiness - now,
      firesCriticalFlag,
      band,
    })
  }
  return impacts
}

// Aggregate what-if: supplier readiness/label if ALL the given fields were skipped
// at once. Used for the "with your skips" summary; never persisted to the store.
export function projectSkippedReadiness(
  context: RequestContext,
  baseOverrides: Record<string, Record<string, unknown>>,
  supplierId: string,
  skippedFields: string[],
): { readiness: number; label: ReadinessLabel } {
  const baseForSupplier = baseOverrides[supplierId] ?? {}
  const blanks = Object.fromEntries(skippedFields.map((fld) => [fld, '']))
  const merged = { ...baseOverrides, [supplierId]: { ...baseForSupplier, ...blanks } }
  const s = evaluate(context, merged).suppliers.find((x) => x.id === supplierId)!
  return { readiness: s.readiness, label: s.label }
}
