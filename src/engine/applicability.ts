import type {
  ApplicabilityStatus,
  BaseStatus,
  DFCode,
  FactorApplicability,
  ReasonStep,
  RequestContext,
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
// fixed rule precedence (Section 2) and building a reason trace per factor.
export function computeApplicability(
  ctx: RequestContext,
  strategy: Strategy,
  weights: Record<DFCode, number>,
): FactorApplicability[] {
  const facts = deriveFacts(ctx)

  return leafFactors.map((lf) => {
    const rule = rules[lf.code]
    const reason: ReasonStep[] = []
    let status: ApplicabilityStatus

    // 1. Not Applicable If — final, cannot be reversed.
    if (evalPredicate(rule.notApplicableIf, facts)) {
      reason.push({ rule: 'Not Applicable If', detail: rule.naText ?? 'Out of scope' })
      return { code: lf.code, df: lf.df as DFCode, name: lf.name, field: lf.canonicalField, status: 'Not Applicable', base: rule.defaultStatus, reason }
    }

    // 2. Mandatory If
    if (evalPredicate(rule.mandatoryIf, facts)) {
      status = 'Mandatory'
      reason.push({ rule: 'Mandatory If', detail: rule.mandatoryText ?? 'Trigger met' })
    }
    // 3. Conditional If
    else if (evalPredicate(rule.conditionalIf, facts)) {
      status = 'Conditional Active'
      reason.push({ rule: 'Conditional If', detail: rule.conditionalText ?? 'Condition active' })
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

    return { code: lf.code, df: lf.df as DFCode, name: lf.name, field: lf.canonicalField, status, base: rule.defaultStatus, reason }
  })
}
