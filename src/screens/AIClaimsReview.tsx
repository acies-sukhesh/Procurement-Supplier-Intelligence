import { useMemo, useState, type CSSProperties } from 'react'
import { useStore } from '../state/store'
import { getDFName, describeClaimMapping } from '../engine/aiExtraction'
import { Card, Icon, Kpi, ClaimTypePill, QualityPill, ReviewStatusPill, ConfidenceBar, SUPPLIER_COLORS } from '../components/ui'
import suppliers from '../data/suppliers.json'
import type { AIClaim, AIClaimType, ClaimReviewStatus } from '../engine/aiTypes'

type FilterDF = 'all' | string
type FilterStatus = 'all' | ClaimReviewStatus
type FilterType = 'all' | AIClaimType
type FilterSupplier = 'all' | string

// All suppliers' claims are shown together in one table (no per-supplier tab
// pattern), consistent with Supplier Data / Evidence Register.
export default function AIClaimsReview({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { aiExtractions, reviewClaim, pushAcceptedClaims } = useStore()
  const [filterSup, setFilterSup] = useState<FilterSupplier>('all')
  const [filterDF, setFilterDF] = useState<FilterDF>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selected, setSelected] = useState<AIClaim | null>(null)
  const [editing, setEditing] = useState<AIClaim | null>(null)
  const [pushed, setPushed] = useState<{ suppliers: string[]; fields: number } | null>(null)

  const extractedSups = suppliers.filter((s) => aiExtractions[s.id])
  const allClaims = useMemo(
    () => Object.values(aiExtractions).flatMap((e) => e.claims),
    [aiExtractions],
  )

  const filtered = useMemo(() => {
    return allClaims.filter((c) => {
      if (filterSup !== 'all' && c.supplierId !== filterSup) return false
      if (filterDF !== 'all' && c.mappedDecisionFactor !== filterDF) return false
      if (filterStatus !== 'all' && c.reviewStatus !== filterStatus) return false
      if (filterType !== 'all' && c.claimType !== filterType) return false
      return true
    })
  }, [allClaims, filterSup, filterDF, filterStatus, filterType])

  const counts = useMemo(() => {
    const r: Record<ClaimReviewStatus, number> = { Pending: 0, Accepted: 0, Rejected: 0 }
    allClaims.forEach((c) => (r[c.reviewStatus] += 1))
    return r
  }, [allClaims])

  const avgConf = allClaims.length > 0
    ? allClaims.reduce((s, c) => s + c.extractionConfidence, 0) / allClaims.length
    : 0

  const acceptAllPending = () =>
    filtered.filter((c) => c.reviewStatus === 'Pending').forEach((c) => reviewClaim(c.supplierId, c.claimId, 'Accepted'))
  const rejectLowConf = () =>
    filtered
      .filter((c) => c.reviewStatus === 'Pending' && c.extractionConfidence < 0.5)
      .forEach((c) => reviewClaim(c.supplierId, c.claimId, 'Rejected'))

  // Suppliers that currently have at least one accepted claim.
  const acceptedSups = useMemo(() => {
    const set = new Set<string>()
    allClaims.forEach((c) => { if (c.reviewStatus === 'Accepted') set.add(c.supplierId) })
    return set
  }, [allClaims])
  // Push targets follow the supplier filter: a specific supplier, or all with accepted claims.
  const pushTargets = (filterSup === 'all' ? [...acceptedSups] : [filterSup]).filter((id) => acceptedSups.has(id))
  const canPush = pushTargets.length > 0
  // Label names the exact target(s) so the user sees who is affected before clicking.
  const pushLabel = pushTargets.length === 0
    ? 'Push accepted claims to validation'
    : pushTargets.length === 1
      ? `Push accepted claims for ${pushTargets[0]}`
      : `Push accepted claims for ${pushTargets.length} suppliers (${pushTargets.join(', ')})`
  const doPush = () => {
    const fields = pushTargets.reduce((n, id) => n + pushAcceptedClaims(id), 0)
    setPushed({ suppliers: pushTargets, fields })
  }

  if (allClaims.length === 0) {
    return (
      <div className="col gap16">
      </div>
    )
  }

  return (
    <div className="col gap16">
      <div className="info-banner">
        <strong>Extracted Claims Review</strong>
        <span>Review each extracted claim before it enters the validation engine. Accept, reject, or edit each one — only accepted claims are used for scoring.</span>
      </div>

      <div className="kpi-row">
        <Kpi num={allClaims.length} label="Total claims" />
        <Kpi num={counts.Pending} label="Pending" accent />
        <Kpi num={counts.Accepted} label="Accepted" />
        <Kpi num={counts.Rejected} label="Rejected" />
        <Kpi num={`${Math.round(avgConf * 100)}%`} label="Avg confidence" />
      </div>

      <Card className="card-pad">
        <div className="between wrap gap12">
          <div className="flex gap8 wrap center">
            <span className="muted" style={{ fontSize: 12.5 }}>Filter:</span>
            <select value={filterSup} onChange={(e) => setFilterSup(e.target.value)} style={selStyle}>
              <option value="all">All suppliers</option>
              {extractedSups.map((s) => (
                <option key={s.id} value={s.id}>{s.id} – {s.name}</option>
              ))}
            </select>
            <select value={filterDF} onChange={(e) => setFilterDF(e.target.value)} style={selStyle}>
              <option value="all">All DFs</option>
              {['DF1','DF2','DF3','DF4','DF5','DF6','DF7'].map((df) => (
                <option key={df} value={df}>{df} – {getDFName(df)}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)} style={selStyle}>
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)} style={selStyle}>
              <option value="all">All types</option>
              <option value="Explicit">Explicit</option>
              <option value="Inferred">Inferred</option>
              <option value="Negative">Negative</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <div className="bulk-actions">
            <button className="bulk-btn accept" onClick={acceptAllPending}>
              <Icon name="check" size={14} /> Accept all pending
            </button>
            <button className="bulk-btn reject" onClick={rejectLowConf}>
              <Icon name="close" size={14} /> Reject low confidence
            </button>
            <button
              className="bulk-btn primary"
              onClick={doPush}
              disabled={!canPush}
              title={canPush ? 'Push accepted claims into the validation engine' : 'Accept at least one claim first'}
            >
              <Icon name="check" size={14} /> {pushLabel}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Claim</th>
                <th>Value</th>
                <th>Type</th>
                <th>Source</th>
                <th>Factor</th>
                <th>Confidence</th>
                <th>Quality</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((claim) => (
                <tr
                  key={claim.claimId}
                  className={`row-clickable ${claim.reviewStatus === 'Accepted' ? 'claim-accepted' : claim.reviewStatus === 'Rejected' ? 'claim-rejected' : ''}`}
                  onClick={() => setSelected(claim)}
                >
                  <td>
                    <span className="flex center gap8">
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[claim.supplierId], display: 'inline-block' }} />
                      <strong style={{ fontWeight: 600 }}>{claim.supplierId}</strong>
                    </span>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {claim.claimText}
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontWeight: 600 }}>{claim.claimValue || '—'}</span>
                    {claim.unit && <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>{claim.unit}</span>}
                  </td>
                  <td><ClaimTypePill type={claim.claimType} /></td>
                  <td>
                    <div style={{ fontSize: 12.5, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {claim.documentName}
                    </div>
                    {claim.sourcePage && <div className="muted" style={{ fontSize: 11 }}>p.{claim.sourcePage}</div>}
                  </td>
                  <td><FactorCell claim={claim} /></td>
                  <td><ConfidenceBar value={claim.extractionConfidence} width={70} /></td>
                  <td><QualityPill quality={claim.evidenceQuality} /></td>
                  <td><ReviewStatusPill status={claim.reviewStatus} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="claim-actions">
                      <button
                        className={`claim-action-btn accept ${claim.reviewStatus === 'Accepted' ? 'done' : ''}`}
                        title="Accept"
                        onClick={() => reviewClaim(claim.supplierId, claim.claimId, 'Accepted')}
                      >
                        <Icon name="check" size={14} />
                      </button>
                      <button
                        className={`claim-action-btn reject ${claim.reviewStatus === 'Rejected' ? 'done' : ''}`}
                        title="Reject"
                        onClick={() => reviewClaim(claim.supplierId, claim.claimId, 'Rejected')}
                      >
                        <Icon name="close" size={14} />
                      </button>
                      <button className="claim-action-btn" title="Edit" onClick={() => setEditing(claim)}>
                        <Icon name="edit" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }} className="muted">
            No claims match the current filters.
          </div>
        )}
      </Card>

      {pushed ? (
        <Card className="card-pad">
          <div className="between wrap gap12">
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
                Pushed {pushed.fields} claim-derived field{pushed.fields === 1 ? '' : 's'} for {pushed.suppliers.join(', ')}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Validation now evaluates {pushed.suppliers.length === 1 ? 'this supplier' : 'these suppliers'} from the
                accepted claims (other suppliers still evaluate from Supplier Data unchanged).
              </div>
            </div>
            <button className="bulk-btn primary" onClick={() => onNavigate?.('validation')}>
              View in Validation →
            </button>
          </div>
        </Card>
      ) : counts.Accepted > 0 && (
        <Card className="card-pad">
          <div className="between">
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
                {counts.Accepted} claims accepted
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Ready to be converted into structured metric values for the validation engine.
              </div>
            </div>
            <span className="pill pass" style={{ fontSize: 13, padding: '5px 14px' }}>✓ Ready for Validation</span>
          </div>
        </Card>
      )}

      {selected && <ClaimDrawer claim={selected} onClose={() => setSelected(null)} />}
      {editing && <EditModal claim={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const selStyle: CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }

// Factor column: real DF/LF codes for scored claims; a single honest "Not scored — …"
// label for identity/context or supplementary claims (never a fabricated factor name).
function FactorCell({ claim }: { claim: AIClaim }) {
  const m = describeClaimMapping(claim)
  if (!m.scored) return <div className="muted" style={{ fontSize: 11 }}>{m.notScoredLabel}</div>
  return (
    <>
      <div style={{ fontSize: 12 }}>{claim.mappedDecisionFactor}</div>
      <div className="muted" style={{ fontSize: 11 }}>{claim.mappedLeafFactor}</div>
    </>
  )
}

// Drawer Mapping rows: correct "DFx · name" / "LFx.y · name" for scored claims (no self-
// duplication), or a single not-scored line otherwise.
function MappingRows({ claim }: { claim: AIClaim }) {
  const m = describeClaimMapping(claim)
  if (!m.scored) {
    return <div className="between"><span className="muted">Mapping</span><strong>{m.notScoredLabel}</strong></div>
  }
  return (
    <>
      <div className="between"><span className="muted">Decision Factor</span><strong>{m.dfLabel}</strong></div>
      <div className="between"><span className="muted">Leaf Factor</span><strong>{m.lfLabel}</strong></div>
    </>
  )
}

function ClaimDrawer({ claim, onClose }: { claim: AIClaim; onClose: () => void }) {
  const { reviewClaim } = useStore()
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head between">
          <div>
            <div className="muted mono" style={{ fontSize: 12 }}>{claim.claimId} · {claim.supplierId} · {claim.mappedLeafFactor}</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>{claim.claimText}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <div className="between" style={{ marginBottom: 16 }}>
            <ClaimTypePill type={claim.claimType} />
            <ReviewStatusPill status={claim.reviewStatus} />
          </div>

          <div className="section-label">Extracted Value</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {claim.claimValue || '—'}
            {claim.unit && <span className="muted" style={{ fontSize: 14, marginLeft: 6 }}>{claim.unit}</span>}
          </div>

          <div className="divider" />

          <div className="section-label">Source</div>
          <div className="col gap8" style={{ fontSize: 13 }}>
            <div className="between"><span className="muted">Document</span><strong>{claim.documentName}</strong></div>
            <div className="between"><span className="muted">Page</span><strong>{claim.sourcePage ?? '—'}</strong></div>
            <div className="between"><span className="muted">Document Type</span><strong>{claim.documentType}</strong></div>
          </div>

          {claim.directQuote && (
            <>
              <div className="divider" />
              <div className="section-label">Direct Quote</div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--graphite)', background: 'var(--panel-soft)', padding: '10px 14px', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                "{claim.directQuote}"
              </div>
            </>
          )}

          <div className="divider" />

          <div className="section-label">Mapping</div>
          <div className="col gap8" style={{ fontSize: 13 }}>
            <MappingRows claim={claim} />
            <div className="between"><span className="muted">Backend Field</span><span className="mono muted">{claim.backendField}</span></div>
          </div>

          <div className="divider" />

          <div className="section-label">Assessment</div>
          <div className="col gap8" style={{ fontSize: 13 }}>
            <div className="between"><span className="muted">Confidence</span><ConfidenceBar value={claim.extractionConfidence} width={100} /></div>
            <div className="between"><span className="muted">Evidence Quality</span><QualityPill quality={claim.evidenceQuality} /></div>
          </div>

          <div className="divider" />

          <div className="flex gap8" style={{ marginTop: 8 }}>
            <button className="bulk-btn accept" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { reviewClaim(claim.supplierId, claim.claimId, 'Accepted'); onClose() }}>
              <Icon name="check" size={14} /> Accept
            </button>
            <button className="bulk-btn reject" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { reviewClaim(claim.supplierId, claim.claimId, 'Rejected'); onClose() }}>
              <Icon name="close" size={14} /> Reject
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function EditModal({ claim, onClose }: { claim: AIClaim; onClose: () => void }) {
  const { reviewClaim } = useStore()
  const [value, setValue] = useState(claim.claimValue)
  const [unit, setUnit] = useState(claim.unit ?? '')
  const [mappedDF, setMappedDF] = useState(claim.mappedDecisionFactor)
  const [mappedLF, setMappedLF] = useState(claim.mappedLeafFactor)

  const save = () => {
    reviewClaim(claim.supplierId, claim.claimId, 'Accepted', {
      claimValue: value,
      unit: unit || null,
      mappedDecisionFactor: mappedDF,
      mappedLeafFactor: mappedLF,
    })
    onClose()
  }

  return (
    <div className="edit-modal-scrim" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-head">
          <h3 style={{ fontSize: 16 }}>Edit Claim</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="edit-modal-body">
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>{claim.claimId} · {claim.supplierId} · {claim.claimText}</div>

          <div className="form-grid">
            <div className="field">
              <label>Extracted Value</label>
              <input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="field">
              <label>Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. %, ratio, days" />
            </div>
            <div className="field">
              <label>Decision Factor</label>
              <select value={mappedDF} onChange={(e) => setMappedDF(e.target.value)}>
                {['DF1','DF2','DF3','DF4','DF5','DF6','DF7'].map((df) => (
                  <option key={df} value={df}>{df} – {getDFName(df)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Leaf Factor</label>
              <input value={mappedLF} onChange={(e) => setMappedLF(e.target.value)} />
            </div>
          </div>

          <div className="divider" />

          <div className="col gap8" style={{ fontSize: 12.5 }}>
            <div className="between"><span className="muted">Source</span><span>{claim.documentName}, p.{claim.sourcePage}</span></div>
            <div className="between"><span className="muted">Confidence</span><ConfidenceBar value={claim.extractionConfidence} width={80} /></div>
            <div className="between"><span className="muted">Original Value</span><span className="mono">{claim.claimValue}</span></div>
          </div>
        </div>
        <div className="edit-modal-foot">
          <button className="bulk-btn" onClick={onClose}>Cancel</button>
          <button className="bulk-btn primary" onClick={save}>Save & Accept</button>
        </div>
      </div>
    </div>
  )
}
