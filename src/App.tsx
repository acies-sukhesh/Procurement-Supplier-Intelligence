import { useMemo, useState } from 'react'
import { useStore } from './state/store'
import { Icon } from './components/ui'
import { PipelineStepper } from './components/PipelineStepper'
import { runFixtures } from './engine/fixtures'
import { buildChecklist, buildGapRegister } from './engine/evidence'
import EvaluationRequest from './screens/EvaluationRequest'
import RulesApplicability from './screens/RulesApplicability'
import EvidenceChecklist from './screens/EvidenceChecklist'
import MetricDictionary from './screens/MetricDictionary'
import SupplierData from './screens/SupplierData'
import Validation from './screens/Validation'
import Aggregation from './screens/Aggregation'
import Comparison from './screens/Comparison'
import Scenario from './screens/Scenario'
import Summary from './screens/Summary'
import AIEvidenceIntake from './screens/AIEvidenceIntake'
import AIClaimsReview from './screens/AIClaimsReview'

type ScreenId =
  | 'request' | 'rules' | 'checklist' | 'intake' | 'review' | 'dictionary' | 'data'
  | 'validation' | 'aggregation' | 'comparison'
  | 'scenario' | 'summary'

interface NavDef { id: ScreenId; label: string; icon: string }
interface NavGroup { label: string; items: NavDef[] }

// Screens that make up the evaluation pipeline — the stepper appears on these.
const PIPELINE: ScreenId[] = ['rules', 'checklist', 'intake', 'review', 'data', 'validation']

// Original group order preserved; the two intake screens are inserted into the
// existing "Evidence" group in pipeline order (checklist → intake → review → register).
const NAV: NavGroup[] = [
  { label: 'Set up', items: [
    { id: 'request', label: 'Evaluation Request', icon: 'request' },
    { id: 'rules', label: 'Rules & Applicability', icon: 'rules' },
  ] },
  { label: 'Evidence', items: [
    { id: 'checklist', label: 'Evidence Checklist', icon: 'checklist' },
    { id: 'intake', label: 'Evidence Intake', icon: 'intake' },
    { id: 'review', label: 'Extracted Claims Review', icon: 'review' },
    { id: 'data', label: 'Evidence Register', icon: 'data' },
  ] },
  { label: 'Reference', items: [
    { id: 'dictionary', label: 'Metric Dictionary', icon: 'dictionary' },
  ] },
  { label: 'Evaluate', items: [
    { id: 'validation', label: 'Validation', icon: 'validation' },
    { id: 'aggregation', label: 'Aggregation & Readiness', icon: 'aggregation' },
    { id: 'comparison', label: 'Supplier Comparison', icon: 'comparison' },
  ] },
  { label: 'Explore', items: [
    { id: 'scenario', label: 'Scenario Impact', icon: 'scenario' },
    { id: 'summary', label: 'Prototype Summary', icon: 'summary' },
  ] },
]

const TITLES: Record<ScreenId, { title: string; sub: string }> = {
  request: { title: 'Evaluation Request', sub: 'Configure the part requirement and sourcing context. Applicable factors are derived live as you change inputs.' },
  rules: { title: 'Rules & Applicability', sub: 'How each of the 43 leaf factors resolves under the current request, with a full reason trace per factor.' },
  checklist: { title: 'Evidence Checklist', sub: 'Simulated: the evidence to request per applicable factor, grouped by source. A presentation layer before the threshold check — no real extraction.' },
  intake: { title: 'Evidence Intake', sub: 'Upload supplier documents and run automated extraction to identify evidence claims, then classify and map them to factors. Simulated for this prototype — no scoring decisions are automated.' },
  review: { title: 'Extracted Claims Review', sub: 'Review each extracted evidence claim. Accept, reject, or edit before it enters the validation engine.' },
  dictionary: { title: 'Metric Dictionary', sub: 'Reference for every canonical field: semantic type, direction, threshold bands, and required evidence.' },
  data: { title: 'Evidence Register', sub: 'Simulated: submitted values with an illustrative claim type, confidence, source reference and gap state per supplier × factor.' },
  validation: { title: 'Validation', sub: 'Each supplier value validated against its threshold rule — pass, watch, evidence gap, or critical flag.' },
  aggregation: { title: 'Aggregation & Readiness', sub: 'Decision-factor roll-up and weighted supplier readiness, with the denominator shown explicitly.' },
  comparison: { title: 'Supplier Comparison', sub: 'Comparative supplier readiness recommendation with relative TOPSIS ranking — never a final approval.' },
  scenario: { title: 'Scenario Impact', sub: 'Compare the current request against a saved baseline to see how applicability and readiness shift.' },
  summary: { title: 'Prototype Summary', sub: 'Fixture verification, scope, and assumptions for this configurable evaluation prototype.' },
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('request')
  const { result, aiExtractions } = useStore()

  const badges = useMemo(() => {
    const active = result.applicability.filter((a) => a.status === 'Mandatory' || a.status === 'Conditional Active').length
    const flags = result.suppliers.reduce((n, s) => n + s.criticalFlags.length, 0)
    const bestFit = [...result.suppliers].sort((a, b) => b.readiness - a.readiness || a.topsisRank - b.topsisRank)[0]
    const checklistItems = buildChecklist(result.applicability).reduce((n, g) => n + g.items.length, 0)
    const gaps = buildGapRegister(result).length
    const fixtures = runFixtures()
    const passed = fixtures.filter((f) => f.pass).length

    // Live pipeline counts — derived only from aiExtractions (populated by runAIExtraction).
    // Zero until a supplier has actually been run through extraction.
    const totalClaims = Object.values(aiExtractions).reduce((n, e) => n + e.claims.length, 0)
    const pendingClaims = Object.values(aiExtractions).reduce((n, e) => n + e.claims.filter((c) => c.reviewStatus === 'Pending').length, 0)
    const acceptedClaims = Object.values(aiExtractions).reduce((n, e) => n + e.claims.filter((c) => c.reviewStatus === 'Accepted').length, 0)
    const contradictions = Object.values(aiExtractions).reduce((n, e) => n + e.contradictions.length, 0)

    return {
      active, flags, bestFit, checklistItems, gaps,
      fixtureText: `${passed}/${fixtures.length}`, fixtureOk: passed === fixtures.length,
      totalClaims, pendingClaims, acceptedClaims, contradictions,
    }
  }, [result, aiExtractions])

  const badgeFor = (id: ScreenId) => {
    if (id === 'rules') return <span className="nav-badge">{badges.active} active</span>
    if (id === 'checklist') return <span className="nav-badge">{badges.checklistItems} items</span>
    if (id === 'data') return badges.gaps > 0 ? <span className="nav-badge red">{badges.gaps} gaps</span> : <span className="nav-badge green">0 gaps</span>
    if (id === 'validation') return badges.flags > 0 ? <span className="nav-badge red">{badges.flags} flags</span> : <span className="nav-badge green">0 flags</span>
    if (id === 'comparison') return <span className="nav-badge gold">{badges.bestFit.id}</span>
    if (id === 'summary') return <span className={`nav-badge ${badges.fixtureOk ? 'green' : 'red'}`}>{badges.fixtureText}</span>
    if (id === 'intake') return badges.totalClaims > 0 ? <span className="nav-badge gold">{badges.totalClaims}</span> : null
    if (id === 'review') return badges.pendingClaims > 0 ? <span className="nav-badge red">{badges.pendingClaims} pending</span> : badges.acceptedClaims > 0 ? <span className="nav-badge green">{badges.acceptedClaims}</span> : null
    return null
  }

  const meta = TITLES[screen]
  const ctx = result.context

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <div className="brand-mark">S</div>
            <div className="brand-title">Supplier<br />Evaluation Engine</div>
          </div>
          <div className="brand-sub">Framework: 7 Decision Factors · 43 Leaf Factors</div>
        </div>
        {NAV.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <button key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => setScreen(item.id)}>
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                {badgeFor(item.id)}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{meta.title}</h1>
            <div className="topbar-sub">{meta.sub}</div>
          </div>
          <div className="topbar-context">
            <span className="tag">{ctx.industry}</span>
            <span className="tag">{ctx.part_criticality}</span>
            <span className="tag">{result.strategy.name}</span>
            <span className="tag">{ctx.monthly_demand.toLocaleString()} units/mo</span>
          </div>
        </header>
        <div className="content">
          {PIPELINE.includes(screen) && (
            <div style={{ marginBottom: 16 }}>
              <PipelineStepper current={screen} onGo={(id) => setScreen(id as ScreenId)} counts={badges} />
            </div>
          )}
          {screen === 'request' && <EvaluationRequest />}
          {screen === 'rules' && <RulesApplicability />}
          {screen === 'checklist' && <EvidenceChecklist />}
          {screen === 'intake' && <AIEvidenceIntake />}
          {screen === 'review' && <AIClaimsReview onNavigate={(id) => setScreen(id as ScreenId)} />}
          {screen === 'dictionary' && <MetricDictionary />}
          {screen === 'data' && <SupplierData />}
          {screen === 'validation' && <Validation />}
          {screen === 'aggregation' && <Aggregation />}
          {screen === 'comparison' && <Comparison />}
          {screen === 'scenario' && <Scenario />}
          {screen === 'summary' && <Summary />}
        </div>
      </main>
    </div>
  )
}
