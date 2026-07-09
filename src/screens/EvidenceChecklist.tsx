import { useMemo, useState, type CSSProperties } from 'react'
import { useStore } from '../state/store'
import { Card, Kpi } from '../components/ui'
import { buildChecklist, SIM_NOTE, type ChecklistGroup, type EvidenceSourceType } from '../engine/evidence'
import { getDocumentsForSupplier } from '../engine/aiExtraction'
import suppliers from '../data/suppliers.json'
import type { AIClaim } from '../engine/aiTypes'

const SOURCE_HINT: Record<EvidenceSourceType, string> = {
  'Request from supplier': 'Supplier is asked to submit these documents.',
  'Buyer records': "Pulled from the buyer's own ERP / QMS systems — no supplier action needed.",
  'Public records': 'Pulled from external / public sources — no supplier action needed.',
}

type ItemStatus = 'Satisfied' | 'Submitted' | 'Missing'
// Reuses the existing status-pill palette (pass / watch / below) — no new visual style.
const STATUS_META: Record<ItemStatus, { cls: string; label: string }> = {
  Satisfied: { cls: 'pass', label: 'Satisfied' },
  Submitted: { cls: 'watch', label: 'Submitted — pending review' },
  Missing: { cls: 'below', label: 'Missing' },
}

// Per-item status from the selected supplier's claims (Step 3 rule).
function statusForField(field: string, claims: AIClaim[]): ItemStatus {
  const forField = claims.filter((c) => c.backendField === field)
  if (forField.some((c) => c.reviewStatus === 'Accepted')) return 'Satisfied'
  if (forField.some((c) => c.reviewStatus !== 'Accepted' && c.claimType !== 'Absent')) return 'Submitted'
  return 'Missing' // an Absent claim, or no claim at all
}

// Same select styling used for the supplier filter on Extracted Claims Review.
const selStyle: CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }

export default function EvidenceChecklist() {
  const { result, aiExtractions, getClaimsForSupplier } = useStore()
  const groups = useMemo(() => buildChecklist(result.applicability), [result.applicability])
  const [supplierId, setSupplierId] = useState(suppliers[0].id)

  const hasPack = getDocumentsForSupplier(supplierId).length > 0

  // Live claims for the selected supplier — extraction state only, no fallback to
  // the static pack file. Before "Run extraction" is clicked for a supplier,
  // getClaimsForSupplier returns [], so every item reads Missing (not-yet-processed).
  // Reactive to accept/reject via the aiExtractions dependency.
  const claims = useMemo<AIClaim[]>(
    () => getClaimsForSupplier(supplierId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiExtractions, supplierId],
  )

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const countFor = (t: EvidenceSourceType) => groups.find((g) => g.sourceType === t)?.items.length ?? 0

  const requestGroup = groups.find((g) => g.sourceType === 'Request from supplier')
  const autoGroups = groups.filter((g) => g.sourceType !== 'Request from supplier')
  const requestItems = requestGroup?.items ?? []
  const getStatus = (field: string): ItemStatus => (hasPack ? statusForField(field, claims) : 'Missing')
  const satisfied = requestItems.filter((it) => getStatus(it.field) === 'Satisfied').length

  return (
    <div className="col gap16">
      <SimBanner />

      <Card className="card-pad">
        <div className="flex center gap8">
          <span className="muted" style={{ fontSize: 12.5 }}>Supplier:</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={selStyle}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.id} – {s.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <div className="kpi-row">
        <Kpi num={total} label="Checklist items" />
        <Kpi num={countFor('Request from supplier')} label="Request from supplier" />
        <Kpi num={countFor('Buyer records')} label="Buyer records" />
        <Kpi num={countFor('Public records')} label="Public records" />
        <Kpi num={`${satisfied} of ${requestItems.length}`} label={`Satisfied · ${supplierId}`} accent />
      </div>

      {!hasPack && (
        <Card className="card-pad">
          <div className="muted" style={{ fontSize: 13 }}>
            {supplierId} has no document pack to extract from in this sample; it is still evaluated from its structured
            Supplier Data. Request-from-supplier items below show as Missing until a pack is submitted.
          </div>
        </Card>
      )}

      {requestGroup && <GroupCard group={requestGroup} getStatus={getStatus} />}

      {autoGroups.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {autoGroups.map((g) => (
            <GroupCard key={g.sourceType} group={g} />
          ))}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12 }}>
        {total} checklist items in scope (Mandatory + Conditional Active only). Status is driven by the live pipeline for
        the selected supplier: items read <strong>Missing</strong> until that supplier's pack is run through Evidence
        Intake, <strong>Submitted — pending review</strong> once a matching claim is extracted, and{' '}
        <strong>Satisfied</strong> once that claim is accepted on Extracted Claims Review.
      </div>
    </div>
  )
}

function GroupCard({
  group,
  getStatus,
}: {
  group: ChecklistGroup
  getStatus?: (field: string) => ItemStatus
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
          const meta = getStatus ? STATUS_META[getStatus(it.field)] : null
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
                {meta ? (
                  <span className={`pill ${meta.cls}`}>{meta.label}</span>
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
      <span>{SIM_NOTE}</span>
    </div>
  )
}
