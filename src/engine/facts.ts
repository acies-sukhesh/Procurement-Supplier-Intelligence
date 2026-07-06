import type { RequestContext } from './types'

// Derives the flat set of boolean facts referenced by the applicability rule
// predicates from the manufacturer's request context.
export function deriveFacts(ctx: RequestContext): Record<string, boolean> {
  const yes = (v: string) => v === 'Yes'
  const criticality = ctx.part_criticality
  const cross_border = yes(ctx.cross_border_sourcing)

  return {
    production: yes(ctx.production_intent),
    demand_exists: ctx.monthly_demand > 0,
    is_safety_critical: criticality === 'Safety Critical',
    criticality_high_or_safety: criticality === 'Safety Critical' || criticality === 'High',
    certificate_required: ctx.required_qms !== 'None',
    regulated_industry: ctx.industry === 'Automotive' || ctx.industry === 'Aerospace',
    automotive: ctx.industry === 'Automotive',
    cross_border,
    design_data_shared: yes(ctx.design_or_ip_shared),
    esg_mandate: yes(ctx.customer_esg_mandate),
    abac_required: yes(ctx.abac_mandated),
    insurance_required: yes(ctx.contract_insurance_required),
    ethical_sourcing_required:
      yes(ctx.mandated_commodity_or_ethics_requirement) || cross_border,
    region_blocked: yes(ctx.region_blocked_or_sanctioned),
    special_process: yes(ctx.special_process_required),
  }
}

// Predicate DSL evaluated against the facts record.
export type Predicate =
  | null
  | { fact: string }
  | { not: Predicate }
  | { all: Predicate[] }
  | { any: Predicate[] }

export function evalPredicate(pred: Predicate, facts: Record<string, boolean>): boolean {
  if (pred == null) return false
  if ('fact' in pred) return !!facts[pred.fact]
  if ('not' in pred) return !evalPredicate(pred.not, facts)
  if ('all' in pred) return pred.all.every((p) => evalPredicate(p, facts))
  if ('any' in pred) return pred.any.some((p) => evalPredicate(p, facts))
  return false
}
