import { useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Card, Icon, Kpi } from '../components/ui'
import { buildChecklist, SIM_NOTE, type ChecklistGroup, type EvidenceSourceType } from '../engine/evidence'

const SOURCE_HINT: Record<EvidenceSourceType, string> = {
  'Request from supplier': 'Supplier is asked to submit these documents.',
  'Buyer records': "Pulled from the buyer's own ERP / QMS systems — no supplier action needed.",
  'Public records': 'Pulled from external / public sources — no supplier action needed.',
}

export default function EvidenceChecklist() {
  const { result } = useStore()
  const groups = useMemo(() => buildChecklist(result.applicability), [result.applicability])
  // Simulated "received" state — attaching a file only flips this flag; nothing is parsed.
  const [received, setReceived] = useState<Record<string, string>>({})

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const countFor = (t: EvidenceSourceType) => groups.find((g) => g.sourceType === t)?.items.length ?? 0
  const receivedCount = Object.keys(received).length

  const requestGroup = groups.find((g) => g.sourceType === 'Request from supplier')
  const autoGroups = groups.filter((g) => g.sourceType !== 'Request from supplier')

  const markReceived = (code: string, name: string) => setReceived((r) => ({ ...r, [code]: name }))

  return (
    <div className="col gap16">
      <SimBanner />

      <div className="kpi-row">
        <Kpi num={total} label="Checklist items" />
        <Kpi num={countFor('Request from supplier')} label="Request from supplier" />
        <Kpi num={countFor('Buyer records')} label="Buyer records" />
        <Kpi num={countFor('Public records')} label="Public records" />
        <Kpi num={receivedCount} label="Received (simulated)" accent />
      </div>

      {requestGroup && <GroupCard group={requestGroup} received={received} onReceived={markReceived} />}

      {autoGroups.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {autoGroups.map((g) => (
            <GroupCard key={g.sourceType} group={g} received={received} onReceived={markReceived} />
          ))}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12 }}>
        {total} checklist items in scope (Mandatory + Conditional Active only). Attaching a file marks an item as received
        for demonstration only — no document is opened, parsed, or extracted.
      </div>
    </div>
  )
}

function GroupCard({
  group,
  received,
  onReceived,
}: {
  group: ChecklistGroup
  received: Record<string, string>
  onReceived: (code: string, name: string) => void
}) {
  return (
    <Card>
      <div className="card-head">
        <div>
          <div className="card-title">{group.sourceType}</div>
          <div className="card-hint">{SOURCE_HINT[group.sourceType]}</div>
        </div>
        <div className="card-hint">{group.items.length} items</div>
      </div>
      <div className="col" style={{ padding: '4px 20px 16px' }}>
        {group.items.map((it) => {
          const rec = received[it.code]
          return (
            <div
              key={it.code}
              className="between wrap"
              style={{ gap: 16, padding: '14px 0', borderBottom: '1px dashed var(--border)' }}
            >
              <div style={{ minWidth: 240, flex: 1 }}>
                <div className="flex center gap8" style={{ marginBottom: 4 }}>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {it.code}
                  </span>
                  <strong style={{ fontWeight: 600 }}>{it.name}</strong>
                  <span className={`pill ${it.applicability === 'Mandatory' ? 'mandatory' : 'conditional'}`}>
                    {it.applicability}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                  {it.why}
                </div>
                <div className="flex gap8 wrap">
                  <span className="muted" style={{ fontSize: 11 }}>
                    Expected evidence:
                  </span>
                  {it.evidence.map((e, i) => (
                    <span key={i} className="tag">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex center gap8">
                {rec ? (
                  <span className="pill pass dot" title={`Simulated — file "${rec}" marked received (not parsed)`}>
                    Received (simulated)
                  </span>
                ) : group.sourceType === 'Request from supplier' ? (
                  <AttachButton onAttach={(name) => onReceived(it.code, name)} />
                ) : (
                  <span className="pill na">Auto-pulled</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function AttachButton({ onAttach }: { onAttach: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onAttach(f.name) // name only — the file is never read or parsed
        }}
      />
      <button className="chip-btn" onClick={() => ref.current?.click()}>
        <span className="flex center gap8">
          <Icon name="flag" size={13} /> Attach evidence
        </span>
      </button>
    </>
  )
}

export function SimBanner() {
  return (
    <div
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        fontSize: 12.5,
        color: 'var(--accent-dark)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontWeight: 700 }}>Simulated</span>
      <span>{SIM_NOTE}</span>
    </div>
  )
}
