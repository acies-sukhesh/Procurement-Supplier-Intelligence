import { useRef, useState } from 'react'
import { Card, Icon } from '../components/ui'
import ruleTemplates from '../data/rule_templates.json'

interface FactorRule {
  code: string
  df: string
  name: string
  field: string
  recommendationType: string
  threshold: string
  dataSource: string
}
interface HierarchyLevel { level: string; scope: string; example: string }
interface Template {
  id: string
  name: string
  version: string
  status: string
  uploadedBy: string
  uploadedAt: string
  appliesTo: { industry: string; criticality: string; productionIntent: string }
  hierarchy: HierarchyLevel[]
  factorRules: FactorRule[]
}

const data = ruleTemplates as unknown as { activeTemplateId: string; templates: Template[] }

const REC_CLASS: Record<string, string> = {
  'Required by Policy': 'mandatory',
  'System Recommended': 'conditional',
  'Not Applicable': 'na',
}

export default function RuleConfiguration() {
  const template = data.templates.find((t) => t.id === data.activeTemplateId) ?? data.templates[0]
  const [showRules, setShowRules] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-rule-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) flash(`Parsed “${f.name}” — ${template.factorRules.length} factor rules recognized. Mock only: the live engine is unchanged.`)
    e.target.value = ''
  }

  const recCount = (t: string) => template.factorRules.filter((r) => r.recommendationType === t).length

  return (
    <div className="col gap16">
      {/* ──── Active template ──── */}
      <Card>
        <div className="card-head">
          <div className="flex center gap8">
            <Icon name="document" size={16} />
            <div className="card-title">Active rule template</div>
          </div>
          <span className="pill pass">{template.status}</span>
        </div>
        <div className="card-pad">
          <div className="between wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>{template.name}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Version {template.version} · uploaded by {template.uploadedBy} · {template.uploadedAt}
              </div>
              <div className="flex center" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="tag">{template.appliesTo.industry}</span>
                <span className="tag">{template.appliesTo.criticality}</span>
                <span className="tag">Production intent: {template.appliesTo.productionIntent}</span>
              </div>
            </div>
            <div className="flex center" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="chip-btn" onClick={downloadSample}>Download sample template</button>
              <button className="chip-btn" onClick={() => fileRef.current?.click()}>Upload rule template</button>
              <button className={`chip-btn ${showRules ? 'active' : ''}`} onClick={() => setShowRules((v) => !v)}>
                {showRules ? 'Hide active rules' : 'View active rules'}
              </button>
              <input ref={fileRef} type="file" accept=".json,.xlsx,.csv" style={{ display: 'none' }} onChange={onUpload} />
            </div>
          </div>
          <div className="flex center" style={{ gap: 16, marginTop: 14 }}>
            <span className="muted" style={{ fontSize: 12 }}><strong style={{ color: 'var(--ink)' }}>{recCount('Required by Policy')}</strong> required by policy</span>
            <span className="muted" style={{ fontSize: 12 }}><strong style={{ color: 'var(--ink)' }}>{recCount('System Recommended')}</strong> system recommended</span>
            <span className="muted" style={{ fontSize: 12 }}><strong style={{ color: 'var(--ink)' }}>{recCount('Not Applicable')}</strong> not applicable</span>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
            Mock — an illustrative policy template (no spreadsheet parsing yet). The recommendation column reflects the
            engine’s reference-context classification; thresholds and data sources come from the metric dictionary. The
            live engine still derives applicability from each request context on the Rules &amp; Applicability screen.
          </p>
        </div>
      </Card>

      {/* ──── Rule hierarchy ──── */}
      <Card>
        <div className="card-head"><div className="card-title">Rule hierarchy</div><div className="card-hint">most general → most specific</div></div>
        <div className="card-pad col gap8">
          {template.hierarchy.map((h, i) => (
            <div key={h.level} className="flex" style={{ gap: 12, alignItems: 'flex-start', paddingLeft: i * 16 }}>
              <span className="mono muted" style={{ fontSize: 11, minWidth: 18, textAlign: 'right', marginTop: 2 }}>{i + 1}</span>
              <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
                <div className="flex center gap8">
                  <strong style={{ fontWeight: 600 }}>{h.level}</strong>
                  <span className="tag">{h.scope}</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{h.example}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ──── Active rules table ──── */}
      {showRules && (
        <Card>
          <div className="card-head"><div className="card-title">Active rules — {template.factorRules.length} factors</div></div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Code</th><th>Factor</th><th>DF</th><th>Recommendation</th><th>Threshold</th><th>Data source</th></tr>
              </thead>
              <tbody>
                {template.factorRules.map((r) => (
                  <tr key={r.code}>
                    <td className="mono muted">{r.code}</td>
                    <td><strong style={{ fontWeight: 600 }}>{r.name}</strong></td>
                    <td className="mono muted">{r.df}</td>
                    <td><span className={`pill ${REC_CLASS[r.recommendationType] ?? 'na'}`}>{r.recommendationType}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.threshold}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{r.dataSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
