import { runFixtures } from '../engine/fixtures'
import { Card, Icon, Kpi } from '../components/ui'

const SCOPE: Array<[string, string]> = [
  ['Framework', '7 decision factors, 43 leaf factors, each with a canonical backend field.'],
  ['Applicability', 'Fixed rule precedence: Not Applicable → Mandatory → Conditional → Default, then Criticality and Strategy upgrades.'],
  ['Validation', 'Presence and format checks first, then threshold banding into Pass / Watch / Below Threshold / Missing / Invalid / Critical Flag.'],
  ['Scoring', 'Status → score, averaged per decision factor, then a strategy-weighted readiness with a mandatory-floor gate.'],
  ['Ranking', 'Relative TOPSIS ranking across the five sample suppliers in the evaluation.'],
  ['Output', 'A comparative supplier readiness recommendation and best-fit shortlist — never a final approval, rejection, or automated decision.'],
]

const ASSUMPTIONS: Array<[string, string]> = [
  ['Data source', 'Local JSON configuration loaded into React state — no backend, database, or authentication.'],
  ['Sample suppliers', 'Five fixed suppliers with representative evidence values driving the demo narrative.'],
  ['Thresholds', 'Representative bands from the specification; fields marked provisional in the Metric Dictionary are pending review.'],
  ['Conditional triggers', 'Derived from the request context where an explicit flag was not supplied separately.'],
  ['LF7.6', 'Capacity Resilience & Redundancy follows the DF7 pattern and is treated as provisional, like every other threshold.'],
  ['Evaluation date', 'Certificate expiry is assessed against the configurable evaluation date on the request.'],
]

export default function Summary() {
  const fixtures = runFixtures()
  const passed = fixtures.filter((f) => f.pass).length

  return (
    <div className="col gap16">
      <div className="kpi-row">
        <Kpi num={`${passed}/${fixtures.length}`} label="Fixtures passing" accent={passed === fixtures.length} />
        <Kpi num="43" label="Leaf factors" />
        <Kpi num="7" label="Decision factors" />
        <Kpi num="5" label="Sample suppliers" />
      </div>

      <Card>
        <div className="card-head"><div className="card-title">Fixture verification</div>
          <span className={`pill ${passed === fixtures.length ? 'pass' : 'below'}`}>{passed === fixtures.length ? 'All fixtures pass' : `${fixtures.length - passed} failing`}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th></th><th>Fixture</th><th>Expected</th><th>Actual</th></tr></thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.id} className={f.pass ? '' : 'row-critical'}>
                  <td style={{ width: 34 }}>
                    <span className="pill" style={{ padding: '2px 6px', background: f.pass ? 'var(--pass-bg)' : 'var(--below-bg)', color: f.pass ? 'var(--pass)' : 'var(--below)' }}>
                      <Icon name={f.pass ? 'check' : 'close'} size={13} />
                    </span>
                  </td>
                  <td>{f.description}</td>
                  <td className="mono muted">{f.expected}</td>
                  <td className="mono" style={{ fontWeight: 600, color: f.pass ? 'var(--pass)' : 'var(--below)' }}>{f.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card>
          <div className="card-head"><div className="card-title">Scope</div></div>
          <div className="card-pad col gap12">
            {SCOPE.map(([k, v]) => (
              <div key={k}><div className="section-label" style={{ marginBottom: 3 }}>{k}</div><div style={{ fontSize: 13, color: 'var(--graphite)' }}>{v}</div></div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card-head"><div className="card-title">Assumptions</div></div>
          <div className="card-pad col gap12">
            {ASSUMPTIONS.map(([k, v]) => (
              <div key={k}><div className="section-label" style={{ marginBottom: 3 }}>{k}</div><div style={{ fontSize: 13, color: 'var(--graphite)' }}>{v}</div></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
