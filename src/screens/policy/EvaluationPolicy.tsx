import { useState } from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import ContextTab from './ContextTab'
import RuleTemplateTab from './RuleTemplateTab'
import ApplicabilityTab from './ApplicabilityTab'

const TABS = [
  { id: 'context', label: 'Context' },
  { id: 'template', label: 'Rule Template' },
  { id: 'applicability', label: 'Applicability & Factors' },
] as const

// "Configure Evaluation Policy" (flow step 4) — merges the old Evaluation Request
// form, Rule Configuration template view, and Rules & Applicability screen into one
// tabbed page instead of three separate nav items.
export default function EvaluationPolicy({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('context')

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E4E7EC' }}>
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>
      {tab === 'context' && <ContextTab />}
      {tab === 'template' && <RuleTemplateTab />}
      {tab === 'applicability' && <ApplicabilityTab onNavigate={onNavigate} />}
    </Box>
  )
}
