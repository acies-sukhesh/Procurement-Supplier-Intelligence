// Mock use-case presets for the "Select Use Case" gate screen. Presentational only —
// influences copy/breadcrumb context, never RequestContext or scoring.
export interface UseCaseDef {
  id: string
  label: string
  description: string
  icon: 'add' | 'gavel' | 'refresh' | 'shield'
  tag?: string
}

export const USE_CASES: UseCaseDef[] = [
  {
    id: 'new-supplier',
    label: 'New Supplier Qualification',
    description: 'Onboard and qualify a supplier you have not sourced from before.',
    icon: 'add',
    tag: 'Most common',
  },
  {
    id: 'rfq-award',
    label: 'RFQ Award Decision',
    description: 'Compare bidders on an open RFQ and recommend an award.',
    icon: 'gavel',
  },
  {
    id: 'requalification',
    label: 'Periodic Requalification',
    description: 'Re-verify an existing supplier still meets policy on schedule.',
    icon: 'refresh',
  },
  {
    id: 'dual-source',
    label: 'Dual-Source Risk Review',
    description: 'Evaluate a backup supplier to reduce single-source risk.',
    icon: 'shield',
  },
]
