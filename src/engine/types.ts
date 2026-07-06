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
  status: ApplicabilityStatus
  base: BaseStatus
  reason: ReasonStep[]
}

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
  score: number | null // average of scored factors, null if none applicable
  scoredCount: number
  hasMandatory: boolean
  belowFloor: boolean
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
