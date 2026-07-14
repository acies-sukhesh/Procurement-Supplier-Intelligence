import type { RequestContext } from '../engine/types'

// Mock component/part presets for the "Select Component" gate screen. Selecting one
// applies `defaults` as a RequestContext patch via the existing setContext() — additive,
// user-editable afterward. Never touches evaluate() or scoring.
export interface ComponentPresetDef {
  id: string
  name: string
  description: string
  defaults: Pick<RequestContext, 'industry' | 'part_criticality' | 'process_type' | 'production_intent' | 'special_process_required'>
}

export const COMPONENT_PRESETS: ComponentPresetDef[] = [
  {
    id: 'cnc-bracket',
    name: 'CNC Machined Bracket',
    description: 'Structural mounting bracket, tight tolerance.',
    defaults: {
      industry: 'Automotive',
      part_criticality: 'High',
      process_type: 'CNC',
      production_intent: 'Yes',
      special_process_required: 'No',
    },
  },
  {
    id: 'molded-housing',
    name: 'Injection Molded Housing',
    description: 'Enclosure for an electromechanical assembly.',
    defaults: {
      industry: 'Electronics',
      part_criticality: 'Safety Critical',
      process_type: 'Assembly',
      production_intent: 'Yes',
      special_process_required: 'Yes',
    },
  },
  {
    id: 'sheet-metal',
    name: 'Sheet Metal Enclosure',
    description: 'Formed and welded industrial enclosure.',
    defaults: {
      industry: 'Industrial',
      part_criticality: 'Medium',
      process_type: 'Stamping',
      production_intent: 'Yes',
      special_process_required: 'No',
    },
  },
  {
    id: 'forged-shaft',
    name: 'Forged Drive Shaft',
    description: 'High-load rotating shaft, safety critical.',
    defaults: {
      industry: 'Aerospace',
      part_criticality: 'Safety Critical',
      process_type: 'Casting',
      production_intent: 'Yes',
      special_process_required: 'Yes',
    },
  },
]
