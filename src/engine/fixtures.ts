import { evaluate } from './evaluate'
import { DEFAULT_CONTEXT } from '../state/store'

export interface Fixture {
  id: string
  description: string
  expected: string
  actual: string
  pass: boolean
}

// Deterministic verification of the engine against the reference request context
// (Section 7 sample dataset). These are the demo's ground-truth expectations.
export function runFixtures(): Fixture[] {
  const res = evaluate(DEFAULT_CONTEXT)
  const byId = Object.fromEntries(res.suppliers.map((s) => [s.id, s]))
  const app = res.applicability
  const naCount = app.filter((a) => a.status === 'Not Applicable').length
  const mandCount = app.filter((a) => a.status === 'Mandatory').length

  const checks: Array<{ id: string; description: string; expected: string; actual: string; pass: boolean }> = []
  const add = (id: string, description: string, expected: string, actual: string) =>
    checks.push({ id, description, expected, actual, pass: expected === actual })

  add('applicability-total', 'All 43 leaf factors are resolved to a status', '43', String(app.length))
  add('applicability-na', 'Reference context marks 3 factors Not Applicable', '3', String(naCount))
  add('applicability-mandatory', 'Reference context yields 34 Mandatory factors', '34', String(mandCount))

  add('SUP-A-label', 'Precision Auto Components → Best-fit Shortlist', 'Best-fit Shortlist', byId['SUP-A'].label)
  add('SUP-B-label', 'Meridian Engineering → Conditional', 'Conditional', byId['SUP-B'].label)
  add('SUP-C-label', 'Apex Machining Works → Needs Review', 'Needs Review', byId['SUP-C'].label)
  add('SUP-D-label', 'Global Forge & Precision → Critical Flag / Review', 'Critical Flag / Review', byId['SUP-D'].label)
  add('SUP-E-label', 'Nova Castings & Machining → Critical Flag / Review', 'Critical Flag / Review', byId['SUP-E'].label)

  add('SUP-D-critical', 'Global Forge trade-compliance hit fires a critical flag', 'true', String(byId['SUP-D'].criticalFlags.length > 0))
  add('SUP-D-underlying', 'Global Forge underlying readiness ≥ 85% despite the flag', 'true', String(byId['SUP-D'].readiness >= 0.85))
  add('SUP-E-critical', 'Nova Castings high credit risk fires a critical flag', 'true', String(byId['SUP-E'].criticalFlags.length > 0))
  add('SUP-C-gate', 'Apex Machining trips the mandatory-floor gate', 'true', String(byId['SUP-C'].gateCapped))
  add('SUP-A-rank', 'Precision Auto Components is TOPSIS rank 1', '1', String(byId['SUP-A'].topsisRank))
  add('topsis-order', 'TOPSIS ranks are unique across all 5 suppliers', '5', String(new Set(res.suppliers.map((s) => s.topsisRank)).size))

  return checks
}
