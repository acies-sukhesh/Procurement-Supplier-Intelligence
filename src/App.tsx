import { useState } from 'react'
import Chip from '@mui/material/Chip'
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import { useStore } from './state/store'
import { AppShell } from './components/AppShell'
import type { FlowStepDef } from './components/ProcessStepper'
import { USE_CASES } from './data/useCases'
import { COMPONENT_PRESETS } from './data/componentPresets'
import LoginScreen from './screens/LoginScreen'
import SelectUseCase from './screens/SelectUseCase'
import SelectComponent from './screens/SelectComponent'
import EvaluationPolicy from './screens/policy/EvaluationPolicy'
import EvidenceFlow from './screens/evidence/EvidenceFlow'
import SupplierEvaluation from './screens/evaluation/SupplierEvaluation'
import SupplierComparison from './screens/SupplierComparison'
import ImprovementOpportunities from './screens/ImprovementOpportunities'
import ScenarioComparison from './screens/ScenarioComparison'
import MetricDictionaryPage from './screens/MetricDictionaryPage'
import SummaryPage from './screens/SummaryPage'

type ScreenId = 'policy' | 'evidence' | 'evaluation' | 'comparison' | 'improvement' | 'scenario'
type ReferenceId = 'dictionary' | 'summary'

const STEPS: Array<Omit<FlowStepDef, 'badge'> & { id: ScreenId }> = [
  { id: 'policy', number: 4, label: 'Evaluation Policy', caption: 'Mandatory · Optional · Locked' },
  { id: 'evidence', number: 5, label: 'Load Supplier Data', caption: 'Documents → Ready' },
  { id: 'evaluation', number: 6, label: 'Supplier Evaluation', caption: 'Factor results & roll-up' },
  { id: 'comparison', number: 7, label: 'Supplier Comparison', caption: 'Ranking & scorecards' },
  { id: 'improvement', number: 8, label: 'Improvement Opportunities', caption: 'Gaps & next actions' },
  { id: 'scenario', number: 9, label: 'Scenario Comparison', caption: 'Compare saved scenarios' },
]

const TITLES: Record<ScreenId, { title: string; sub: string }> = {
  policy: { title: 'Configure Evaluation Policy', sub: 'Mandatory, optional, and locked factors — plus the sourcing context that drives them.' },
  evidence: { title: 'Load Supplier Data', sub: 'Documents, extraction, mapped factors, and evidence gaps in one pipeline.' },
  evaluation: { title: 'Supplier Evaluation', sub: 'Per-factor results and the weighted decision-factor roll-up.' },
  comparison: { title: 'Supplier Comparison', sub: 'Relative readiness ranking — never a final approval.' },
  improvement: { title: 'Improvement Opportunities', sub: 'What would raise each supplier’s readiness.' },
  scenario: { title: 'Scenario Comparison', sub: 'Compare the current request against saved scenarios.' },
}

const REFERENCE_TITLES: Record<ReferenceId, { title: string; sub: string }> = {
  dictionary: { title: 'Metric Dictionary', sub: 'Reference for every canonical field, threshold band, and required evidence.' },
  summary: { title: 'Prototype Summary', sub: 'Fixture verification, scope, and assumptions.' },
}

export default function App() {
  const { authed, useCaseId, componentId, setUseCaseId, setComponentId, manufacturerName } = useStore()
  const [screen, setScreen] = useState<ScreenId>('policy')
  const [reference, setReference] = useState<ReferenceId | null>(null)

  if (!authed) return <LoginScreen />
  if (!useCaseId) return <SelectUseCase onContinue={() => {}} />
  if (!componentId) return <SelectComponent onContinue={() => {}} />

  const go = (id: string) => {
    setReference(null)
    setScreen(id as ScreenId)
  }
  const goReference = (id: string) => setReference(id as ReferenceId)

  const currentIndex = STEPS.findIndex((s) => s.id === screen)
  const completedIds = reference ? STEPS.map((s) => s.id) : STEPS.slice(0, currentIndex).map((s) => s.id)
  const useCase = USE_CASES.find((u) => u.id === useCaseId)
  const component = COMPONENT_PRESETS.find((c) => c.id === componentId)
  const meta = reference ? REFERENCE_TITLES[reference] : TITLES[screen]

  return (
    <AppShell
      steps={STEPS}
      current={reference ? '' : screen}
      completedIds={completedIds}
      onGo={go}
      referenceItems={[
        { id: 'dictionary', label: 'Metric Dictionary', icon: <MenuBookRoundedIcon fontSize="small" /> },
        { id: 'summary', label: 'Prototype Summary', icon: <FactCheckOutlinedIcon fontSize="small" /> },
      ]}
      referenceCurrent={reference}
      onGoReference={goReference}
      breadcrumb={[manufacturerName ?? 'Manufacturer', useCase?.label ?? 'Use case', component?.name ?? 'Component']}
      pageTitle={meta.title}
      pageSubtitle={meta.sub}
      contextChips={
        <>
          <Chip size="small" label={useCase?.label} onDelete={() => setUseCaseId('')} />
          <Chip size="small" label={component?.name} onDelete={() => setComponentId('')} color="primary" variant="outlined" />
        </>
      }
    >
      {!reference && screen === 'policy' && <EvaluationPolicy onNavigate={go} />}
      {!reference && screen === 'evidence' && <EvidenceFlow onNavigate={go} />}
      {!reference && screen === 'evaluation' && <SupplierEvaluation onNavigate={go} />}
      {!reference && screen === 'comparison' && <SupplierComparison onNavigate={go} />}
      {!reference && screen === 'improvement' && <ImprovementOpportunities />}
      {!reference && screen === 'scenario' && <ScenarioComparison />}
      {reference === 'dictionary' && <MetricDictionaryPage />}
      {reference === 'summary' && <SummaryPage />}
    </AppShell>
  )
}

// Icons used by STEPS captions elsewhere if needed later.
export const STEP_ICONS = {
  policy: AssignmentRoundedIcon,
  evidence: CloudUploadRoundedIcon,
  evaluation: FactCheckRoundedIcon,
  comparison: BarChartRoundedIcon,
  improvement: TipsAndUpdatesRoundedIcon,
  scenario: CompareArrowsRoundedIcon,
}
