import type {
  DFCode,
  DFResult,
  EvaluationResult,
  FactorApplicability,
  FactorValidation,
  ReadinessLabel,
  RequestContext,
  Strategy,
  SupplierResult,
  ValidationStatus,
} from './types'
import { computeApplicability } from './applicability'
import { validateFactor } from './validation'
import decisionFactors from '../data/decisionFactors.json'
import strategies from '../data/strategies.json'
import scoringConfig from '../data/scoringConfig.json'
import suppliersData from '../data/suppliers.json'

const DF_CODES = decisionFactors.map((d) => d.code) as DFCode[]
const ALL_STATUSES: ValidationStatus[] = ['Pass', 'Watch', 'Below Threshold', 'Missing', 'Invalid', 'Critical Flag', 'Not Applicable']

export function getStrategy(ctx: RequestContext): Strategy {
  const found = (strategies as Strategy[]).find((s) => s.id === ctx.sourcing_strategy)
  if (found) return found
  // Custom strategy — weights supplied on the context.
  const weights = ctx.customWeights ?? { DF1: 15, DF2: 15, DF3: 15, DF4: 15, DF5: 13, DF6: 13, DF7: 14 }
  return { id: 'Custom', name: 'Custom', weights, mandatoryFloor: 0.45 }
}

export function getWeights(ctx: RequestContext, strategy: Strategy): Record<DFCode, number> {
  if (strategy.id === 'Custom') return ctx.customWeights ?? strategy.weights
  return strategy.weights
}

function emptyCounts(): Record<ValidationStatus, number> {
  const c = {} as Record<ValidationStatus, number>
  ALL_STATUSES.forEach((s) => (c[s] = 0))
  return c
}

function labelForReadiness(readiness: number): ReadinessLabel {
  for (const band of scoringConfig.labelBands) {
    if (readiness >= band.min) return band.label as ReadinessLabel
  }
  return 'Low Fit'
}

function evaluateSupplier(
  supplier: (typeof suppliersData)[number],
  applicability: FactorApplicability[],
  ctx: RequestContext,
  strategy: Strategy,
  weights: Record<DFCode, number>,
): Omit<SupplierResult, 'topsisScore' | 'topsisRank'> {
  const values = supplier.values as Record<string, unknown>
  const factors: FactorValidation[] = applicability.map((a) =>
    validateFactor(a.field, values[a.field], a.status, ctx, values),
  )

  const counts = emptyCounts()
  factors.forEach((f) => (counts[f.status] += 1))

  // Per decision factor roll-up.
  const mean = (fs: FactorValidation[]) => fs.reduce((s, f) => s + (f.score as number), 0) / fs.length
  const dfResults: DFResult[] = DF_CODES.map((code) => {
    const meta = decisionFactors.find((d) => d.code === code)!
    const dfFactors = factors.filter((f) => f.df === code)

    // DF Score = mean of the Mandatory / Conditional-Active leaf factors only.
    // Optional factors are still scored per-leaf (for the register/UI) but excluded
    // from the DF denominator whenever any required factor is in scope. Not Applicable
    // factors already carry a null score and are never counted.
    const required = dfFactors.filter(
      (f) => (f.applicability === 'Mandatory' || f.applicability === 'Conditional Active') && f.score !== null,
    )

    let score: number | null
    let scoredCount: number
    let optionalFallback = false
    if (required.length > 0) {
      score = mean(required)
      scoredCount = required.length
    } else {
      // Fallback: no Mandatory / Conditional-Active factor is applicable for this DF,
      // so fall back to the mean of whatever Optional factors are applicable and flag
      // the DF as resting on optional evidence only.
      // NOTE: currently dead code — every DF has at least one unconditional
      // default-Mandatory leaf that no request context can drop (e.g. DF6 → LF6.1
      // Regulatory & Legal Compliance, which has no notApplicableIf rule), so
      // `required` is never empty in practice. Kept as defensive behavior in case the
      // applicability rules change to allow a DF with no required factors in scope.
      const optional = dfFactors.filter((f) => f.applicability === 'Optional' && f.score !== null)
      score = optional.length ? mean(optional) : null
      scoredCount = optional.length
      optionalFallback = optional.length > 0
    }

    const hasMandatory = applicability.some((a) => a.df === code && a.status === 'Mandatory')
    const belowFloor = score !== null && hasMandatory && score < strategy.mandatoryFloor
    return { df: code, name: meta.name, short: meta.short, weight: weights[code], score, scoredCount, hasMandatory, belowFloor, optionalFallback }
  })

  // Readiness = weighted average over decision factors that have a score.
  let wsum = 0
  let acc = 0
  dfResults.forEach((d) => {
    if (d.score !== null) {
      acc += d.score * d.weight
      wsum += d.weight
    }
  })
  const readiness = wsum > 0 ? acc / wsum : 0

  const criticalFlags = factors.filter((f) => f.critical)
  const gateCapped = dfResults.some((d) => d.belowFloor)

  // Label with critical override and mandatory-floor gate cap.
  let label: ReadinessLabel
  if (criticalFlags.length > 0) {
    label = scoringConfig.criticalFlagLabel as ReadinessLabel
  } else {
    label = labelForReadiness(readiness)
    if (gateCapped) {
      const capOrder: ReadinessLabel[] = ['Low Fit', 'Needs Review', 'Conditional', 'Best-fit Shortlist']
      const cap = scoringConfig.gateCapLabel as ReadinessLabel
      if (capOrder.indexOf(label) > capOrder.indexOf(cap)) label = cap
    }
  }

  return { id: supplier.id, name: supplier.name, summary: supplier.summary, factors, dfResults, readiness, label, gateCapped, criticalFlags, counts }
}

function computeTopsis(
  results: Omit<SupplierResult, 'topsisScore' | 'topsisRank'>[],
  weights: Record<DFCode, number>,
): { score: number; rank: number }[] {
  // Weighted DF-score matrix: rows = suppliers, cols = DF_score * weight.
  const matrix = results.map((r) =>
    DF_CODES.map((code) => {
      const df = r.dfResults.find((d) => d.df === code)!
      return (df.score ?? 0) * weights[code]
    }),
  )
  const best = DF_CODES.map((_, c) => Math.max(...matrix.map((row) => row[c])))
  const worst = DF_CODES.map((_, c) => Math.min(...matrix.map((row) => row[c])))

  const scores = matrix.map((row) => {
    const dPlus = Math.sqrt(row.reduce((s, v, c) => s + (v - best[c]) ** 2, 0))
    const dMinus = Math.sqrt(row.reduce((s, v, c) => s + (v - worst[c]) ** 2, 0))
    const denom = dPlus + dMinus
    return denom === 0 ? 0.5 : dMinus / denom
  })

  const order = scores.map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s)
  const rank: number[] = new Array(scores.length)
  order.forEach((o, idx) => (rank[o.i] = idx + 1))
  return scores.map((s, i) => ({ score: s, rank: rank[i] }))
}

// Runs the full evaluation for the current request context across all suppliers.
// `overrides` lets accepted, human-reviewed AI claims override specific supplier
// values (keyed by supplierId → { field: value }). Empty overrides (the default)
// reproduce the suppliers.json-driven path exactly.
// `userSelections` maps factor codes to boolean inclusion overrides for non-locked factors.
export function evaluate(
  ctx: RequestContext,
  overrides: Record<string, Record<string, unknown>> = {},
  userSelections: Record<string, boolean> = {},
): EvaluationResult {
  const strategy = getStrategy(ctx)
  const weights = getWeights(ctx, strategy)
  const applicability = computeApplicability(ctx, strategy, weights, userSelections)

  const partial = suppliersData.map((s) => {
    const ov = overrides[s.id]
    const supplier = ov ? ({ ...s, values: { ...(s.values as Record<string, unknown>), ...ov } } as typeof s) : s
    return evaluateSupplier(supplier, applicability, ctx, strategy, weights)
  })
  const topsis = computeTopsis(partial, weights)
  const suppliers: SupplierResult[] = partial.map((p, i) => ({ ...p, topsisScore: topsis[i].score, topsisRank: topsis[i].rank }))

  return { applicability, suppliers, strategy, weights, context: ctx }
}

export { DF_CODES }
