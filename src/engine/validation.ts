import type {
  ApplicabilityStatus,
  DFCode,
  FactorValidation,
  RequestContext,
  ValidationStatus,
} from './types'
import { deriveFacts } from './facts'
import metrics from '../data/metrics.json'
import scoringConfig from '../data/scoringConfig.json'
import leafFactors from '../data/leafFactors.json'

interface MetricDef {
  type: 'numeric' | 'enum' | 'date'
  unit: string
  direction: 'gte' | 'lte' | 'enum' | 'date'
  pass?: number
  watch?: number
  relativeTo?: string
  dependency?: { field: string; op: 'lte' | 'gte' }
  passSet?: string[]
  watchSet?: string[]
  failSet?: string[]
  bufferDays?: number
  criticalFlagRule?: string
  evidence: string
  provisional: boolean
}

const metricDefs = metrics as unknown as Record<string, MetricDef>
const statusScores = scoringConfig.statusScores as Record<string, number>

const leafByField = new Map(leafFactors.map((lf) => [lf.canonicalField, lf]))

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

function formatValue(v: unknown, def: MetricDef): string {
  if (isBlank(v)) return '—'
  if (def.type === 'numeric') {
    const n = Number(v)
    if (def.unit === 'USD') return '$' + n.toLocaleString()
    if (def.unit === '%') return n + '%'
    return `${n} ${def.unit}`.trim()
  }
  return String(v)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

// Determines whether a below-threshold / fail value escalates to a Critical Flag
// given the active request context (Section 4 conditional critical-flag rules).
function evalCriticalFlag(
  rule: string | undefined,
  value: unknown,
  def: MetricDef,
  facts: Record<string, boolean>,
): boolean {
  if (!rule) return false
  const v = String(value)
  const inFail = def.failSet?.includes(v) ?? false
  switch (rule) {
    case 'trade':
      return inFail && facts.cross_border
    case 'ppap':
      return inFail && (facts.is_safety_critical || facts.production) // Missing does not trigger
    case 'qms_cert':
      return false // handled inline in the date branch
    case 'regulatory':
      return inFail // always
    case 'credit':
      return inFail && facts.production
    case 'abac':
      return inFail && facts.abac_required
    case 'data_security':
      return inFail && facts.design_data_shared
    case 'geo':
      return inFail && facts.region_blocked
    default:
      return false
  }
}

export function validateFactor(
  field: string,
  rawValue: unknown,
  applicability: ApplicabilityStatus,
  ctx: RequestContext,
  supplierValues: Record<string, unknown> = {},
): FactorValidation {
  const lf = leafByField.get(field)!
  const def = metricDefs[field]
  const facts = deriveFacts(ctx)
  const base = {
    code: lf.code,
    df: lf.df as DFCode,
    name: lf.name,
    field,
    applicability,
    value: rawValue,
    displayValue: formatValue(rawValue, def),
  }

  const finalize = (status: ValidationStatus, note: string, critical = false): FactorValidation => ({
    ...base,
    status,
    score: status === 'Not Applicable' ? null : critical ? statusScores['Critical Flag'] : statusScores[status] ?? 0,
    note,
    critical,
  })

  if (applicability === 'Not Applicable') {
    return finalize('Not Applicable', 'Excluded from evaluation by applicability rules.')
  }

  const blank = isBlank(rawValue)

  // --- Date fields (certificate expiry) ---
  if (def.type === 'date') {
    const certRequired = facts.certificate_required
    if (blank) {
      // Absent certificate is a critical gate only when a certificate is required.
      if (def.criticalFlagRule === 'qms_cert' && certRequired) {
        return finalize('Critical Flag', 'Required certificate is absent.', true)
      }
      return finalize('Missing', 'No certificate on file.')
    }
    const evalDate = new Date(ctx.eval_date)
    const expiry = new Date(String(rawValue))
    if (isNaN(expiry.getTime())) return finalize('Invalid', 'Certificate date is not a valid date.')
    const buffer = def.bufferDays ?? 30
    const daysToExpiry = daysBetween(expiry, evalDate)
    if (daysToExpiry < 0) {
      const crit = def.criticalFlagRule === 'qms_cert' && certRequired
      return finalize(crit ? 'Critical Flag' : 'Below Threshold', `Certificate expired ${-daysToExpiry} days ago.`, crit)
    }
    if (daysToExpiry < buffer) {
      return finalize('Watch', `Certificate expires in ${daysToExpiry} days (within ${buffer}-day buffer).`)
    }
    return finalize('Pass', `Valid, expires in ${daysToExpiry} days.`)
  }

  // --- Presence check for non-date fields ---
  if (blank) {
    return finalize('Missing', 'No value provided — evidence gap.')
  }

  // --- Enum fields ---
  if (def.type === 'enum') {
    const v = String(rawValue)
    const inPass = def.passSet?.includes(v) ?? false
    const inWatch = def.watchSet?.includes(v) ?? false
    const inFail = def.failSet?.includes(v) ?? false
    const critical = evalCriticalFlag(def.criticalFlagRule, v, def, facts)
    if (critical) return finalize('Critical Flag', `"${v}" fires a critical flag under the active request context.`, true)
    if (inPass) return finalize('Pass', `"${v}" meets requirement.`)
    if (inWatch) return finalize('Watch', `"${v}" acceptable with monitoring.`)
    if (inFail) return finalize('Below Threshold', `"${v}" is below the required standard.`)
    return finalize('Invalid', `"${v}" is not a recognized value for this field.`)
  }

  // --- Numeric fields ---
  const n = Number(rawValue)
  if (isNaN(n)) return finalize('Invalid', 'Value is not numeric.')

  // Dependency / range check (e.g. available capacity must not exceed installed).
  if (def.dependency) {
    const otherRaw = supplierValues[def.dependency.field]
    if (!isBlank(otherRaw)) {
      const other = Number(otherRaw)
      if (def.dependency.op === 'lte' && n > other) {
        return finalize('Invalid', `Value (${n}) exceeds ${def.dependency.field.replace(/_/g, ' ')} (${other}).`)
      }
      if (def.dependency.op === 'gte' && n < other) {
        return finalize('Invalid', `Value (${n}) is below ${def.dependency.field.replace(/_/g, ' ')} (${other}).`)
      }
    }
  }

  let passT = def.pass!
  let watchT = def.watch!
  let ratioNote = ''
  if (def.relativeTo) {
    const basis = Number((ctx as unknown as Record<string, number>)[def.relativeTo]) || 0
    passT = def.pass! * basis
    watchT = def.watch! * basis
    ratioNote = basis > 0 ? ` (${Math.round((n / basis) * 100)}% of ${def.relativeTo.replace(/_/g, ' ')})` : ''
  }

  const critical = evalCriticalFlag(def.criticalFlagRule, n, def, facts)

  if (def.direction === 'gte') {
    if (n >= passT) return finalize('Pass', `${base.displayValue} ≥ ${passT}${ratioNote}.`)
    if (n >= watchT) return finalize('Watch', `${base.displayValue} in watch band${ratioNote}.`)
    return finalize(critical ? 'Critical Flag' : 'Below Threshold', `${base.displayValue} below ${watchT}${ratioNote}.`, critical)
  } else {
    if (n <= passT) return finalize('Pass', `${base.displayValue} ≤ ${passT}${ratioNote}.`)
    if (n <= watchT) return finalize('Watch', `${base.displayValue} in watch band${ratioNote}.`)
    return finalize(critical ? 'Critical Flag' : 'Below Threshold', `${base.displayValue} above ${watchT}${ratioNote}.`, critical)
  }
}
