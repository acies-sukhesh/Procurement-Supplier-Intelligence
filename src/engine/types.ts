// Core domain types for the Supplier Evaluation Engine.

export type DFCode = 'DF1' | 'DF2' | 'DF3' | 'DF4' | 'DF5' | 'DF6' | 'DF7'

export type ApplicabilityStatus =
  | 'Mandatory'
  | 'Optional'
  | 'Conditional Active'
  | 'Not Applicable'

export type BaseStatus = 'Mandatory' | 'Optional' | 'Conditional'

export type ValidationStatus =
  | 'Pass'
  | 'Watch'
  | 'Below Threshold'
  | 'Missing'
  | 'Invalid'
  | 'Critical Flag'
  | 'Not Applicable'

export type ReadinessLabel =
  | 'Best-fit Shortlist'
  | 'Conditional'
  | 'Needs Review'
  | 'Low Fit'
  | 'Critical Flag / Review'

export interface LeafFactor {
  code: string
  df: DFCode
  name: string
  canonicalField: string
}

export interface DecisionFactor {
  code: DFCode
  name: string
  short: string
}

export interface Strategy {
  id: string
  name: string
  weights: Record<DFCode, number>
  mandatoryFloor: number
}

// The manufacturer's evaluation request context (Section 2).
export interface RequestContext {
  industry: 'Automotive' | 'Aerospace' | 'Electronics' | 'Industrial'
  part_criticality: 'Safety Critical' | 'High' | 'Medium' | 'Low'
  production_intent: 'Yes' | 'No'
  process_type: 'CNC' | 'Casting' | 'Welding' | 'Stamping' | 'Assembly'
  special_process_required: 'Yes' | 'No'
  cross_border_sourcing: 'Yes' | 'No'
  design_or_ip_shared: 'Yes' | 'No'
  customer_esg_mandate: 'Yes' | 'No'
  abac_mandated: 'Yes' | 'No'
  contract_insurance_required: 'Yes' | 'No'
  sourcing_strategy: string
  required_qms: 'IATF' | 'AS9100' | 'ISO 9001' | 'ISO 13485' | 'None'
  mandated_commodity_or_ethics_requirement: 'Yes' | 'No'
  region_blocked_or_sanctioned: 'Yes' | 'No'
  monthly_demand: number
  eval_date: string // ISO date the evaluation runs as of
  customWeights?: Record<DFCode, number>
}

export interface ReasonStep {
  rule: string
  detail: string
}

export interface FactorApplicability {
  code: string
  df: DFCode
  name: string
  field: string
  status: ApplicabilityStatus        // final status used by scoring (after user selection applied)
  base: BaseStatus                   // the default status from applicabilityRules.json
  ruleStatus: ApplicabilityStatus    // the policy recommendation computed by the rule engine (before user selection)
  selectionType: SelectionType       // determines UI behavior for this factor
  locked: boolean                    // true if the user cannot change this factor's inclusion
  includedInEvaluation: boolean      // true if this factor is active in the scoring denominator
  reason: ReasonStep[]
}

export type SelectionType =
  | 'policy-required'       // Mandatory — locked, always included
  | 'system-recommended'    // Conditional Active — included by default, user can skip
  | 'optional'              // Optional — excluded by default, user can add
  | 'not-applicable'        // Not Applicable — locked, always excluded

export interface FactorValidation {
  code: string
  df: DFCode
  name: string
  field: string
  applicability: ApplicabilityStatus
  value: unknown
  displayValue: string
  status: ValidationStatus
  score: number | null // null = excluded from denominator
  note: string
  critical: boolean
}

export interface DFResult {
  df: DFCode
  name: string
  short: string
  weight: number
  score: number | null // mean of the Mandatory/Conditional-Active factors, null if none scored
  scoredCount: number // number of factors in the DF-score denominator
  hasMandatory: boolean
  belowFloor: boolean
  optionalFallback: boolean // true when no required factor was in scope and the score rests on Optional factors only
}

export interface SupplierResult {
  id: string
  name: string
  summary: string
  factors: FactorValidation[]
  dfResults: DFResult[]
  readiness: number // 0..1
  label: ReadinessLabel
  gateCapped: boolean
  criticalFlags: FactorValidation[]
  topsisScore: number
  topsisRank: number
  counts: Record<ValidationStatus, number>
}

export interface EvaluationResult {
  applicability: FactorApplicability[]
  suppliers: SupplierResult[]
  strategy: Strategy
  weights: Record<DFCode, number>
  context: RequestContext
}

// Persisted scenario — stores inputs only; results are recomputed live via evaluate().
export interface SavedScenario {
  id: string
  name: string
  timestamp: string                          // ISO date string
  context: RequestContext
  weights: Record<DFCode, number>
  userSelections: Record<string, boolean>     // true = included, false = skipped
}

// Impact analysis for a single inactive factor — what happens if the user adds it.
export interface FactorImpact {
  code: string
  name: string
  df: DFCode
  field: string
  selectionType: SelectionType
  readinessDelta: Record<string, number>     // supplierId → readiness change
  confidenceDelta: number                    // change in active-factor coverage (0..1)
  riskBlindSpot: string                      // what risk area is unmonitored
  missingDataSource: string                  // the evidence document needed
}
