import type {
  ApplicabilityStatus,
  BaseStatus,
  DFCode,
  FactorApplicability,
  ReasonStep,
  RequestContext,
  SelectionType,
  Strategy,
} from './types'
import { deriveFacts, evalPredicate, type Predicate } from './facts'
import leafFactors from '../data/leafFactors.json'
import applicabilityRules from '../data/applicabilityRules.json'

interface RuleDef {
  defaultStatus: BaseStatus
  criticalitySensitive: boolean
  strategyDf: DFCode
  strategyUpgradeThreshold: number
  notApplicableIf: Predicate
  mandatoryIf: Predicate
  conditionalIf: Predicate
  naText: string | null
  mandatoryText: string | null
  conditionalText: string | null
  criticalityText: string | null
  strategyText: string | null
}

const rules = applicabilityRules as unknown as Record<string, RuleDef>

// Computes the final applicability status for every leaf factor, applying the
// fixed rule precedence (Section 2), building a reason trace per factor, and
// merging user selections for non-locked factors.
export function computeApplicability(
  ctx: RequestContext,
  strategy: Strategy,
  weights: Record<DFCode, number>,
  userSelections: Record<string, boolean> = {},
): FactorApplicability[] {
  const facts = deriveFacts(ctx)

  return leafFactors.map((lf) => {
    const rule = rules[lf.code]
    const reason: ReasonStep[] = []
    let status: ApplicabilityStatus

    // ── Step 1: Compute policy recommendation (rule engine) ──────────

    // 1. Not Applicable If — final, cannot be reversed.
    if (evalPredicate(rule.notApplicableIf, facts)) {
      reason.push({ rule: 'Policy Excluded', detail: rule.naText ?? 'Out of scope' })
      const ruleStatus: ApplicabilityStatus = 'Not Applicable'
      return {
        code: lf.code,
        df: lf.df as DFCode,
        name: lf.name,
        field: lf.canonicalField,
        status: ruleStatus,
        base: rule.defaultStatus,
        ruleStatus,
        selectionType: 'not-applicable' as SelectionType,
        locked: true,
        includedInEvaluation: false,
        reason,
      }
    }

    // 2. Mandatory If
    if (evalPredicate(rule.mandatoryIf, facts)) {
      status = 'Mandatory'
      reason.push({ rule: 'Policy Required', detail: rule.mandatoryText ?? 'Trigger met' })
    }
    // 3. Conditional If
    else if (evalPredicate(rule.conditionalIf, facts)) {
      status = 'Conditional Active'
      reason.push({ rule: 'System Recommended', detail: rule.conditionalText ?? 'Condition active' })
    }
    // 4. Default
    else {
      status = rule.defaultStatus === 'Conditional' ? 'Conditional Active' : rule.defaultStatus
      reason.push({ rule: 'Default', detail: `Base status: ${rule.defaultStatus}` })
    }

    // 5. Criticality upgrade: Optional -> Mandatory
    const highCrit = ctx.part_criticality === 'Safety Critical' || ctx.part_criticality === 'High'
    if (status === 'Optional' && rule.criticalitySensitive && highCrit) {
      status = 'Mandatory'
      reason.push({ rule: 'Criticality Upgrade', detail: `${ctx.part_criticality} upgrades Optional to Mandatory — ${rule.criticalityText ?? ''}`.trim() })
    }

    // 6. Strategy upgrade: Optional -> Mandatory when the DF weight meets threshold
    if (status === 'Optional') {
      const w = weights[rule.strategyDf] ?? 0
      if (w >= rule.strategyUpgradeThreshold) {
        status = 'Mandatory'
        reason.push({ rule: 'Strategy Upgrade', detail: `${strategy.name}: ${rule.strategyDf} weight ${w} meets threshold ${rule.strategyUpgradeThreshold} — ${rule.strategyText ?? ''}`.trim() })
      }
    }

    // Record the rule engine's recommendation before user selection.
    const ruleStatus = status

    // ── Step 2: Derive selection type and locked state ────────────────

    let selectionType: SelectionType
    let locked: boolean
    let includedInEvaluation: boolean

    if (ruleStatus === 'Mandatory') {
      selectionType = 'policy-required'
      locked = true
      includedInEvaluation = true
    } else if (ruleStatus === 'Conditional Active') {
      selectionType = 'system-recommended'
      locked = false
      // Included by default; user can skip (userSelections[code] === false)
      includedInEvaluation = userSelections[lf.code] !== false
    } else {
      // Optional
      selectionType = 'optional'
      locked = false
      // Excluded by default; user can add (userSelections[code] === true)
      includedInEvaluation = userSelections[lf.code] === true
    }

    // ── Step 3: Compute final status from includedInEvaluation ───────

    let finalStatus: ApplicabilityStatus
    if (ruleStatus === 'Mandatory') {
      finalStatus = 'Mandatory'
    } else if (includedInEvaluation) {
      // User included this factor — treat as Conditional Active for scoring
      finalStatus = 'Conditional Active'
      if (ruleStatus === 'Optional') {
        reason.push({ rule: 'User Selection', detail: 'Added by user — included in evaluation' })
      }
    } else {
      // User skipped or factor defaults to excluded
      finalStatus = 'Optional'
      if (ruleStatus === 'Conditional Active') {
        reason.push({ rule: 'User Selection', detail: 'Skipped by user — excluded from evaluation' })
      }
    }

    return {
      code: lf.code,
      df: lf.df as DFCode,
      name: lf.name,
      field: lf.canonicalField,
      status: finalStatus,
      base: rule.defaultStatus,
      ruleStatus,
      selectionType,
      locked,
      includedInEvaluation,
      reason,
    }
  })
}
