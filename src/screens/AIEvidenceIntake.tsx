import { useStore } from '../state/store'
import { getDocumentsForSupplier, classifyDocuments } from '../engine/aiExtraction'
import { Card, Icon, Kpi, SUPPLIER_COLORS } from '../components/ui'
import suppliers from '../data/suppliers.json'
import type { UploadedDocument, DocumentClassification, MissingEvidence, Contradiction } from '../engine/aiTypes'

// All suppliers are shown together (no per-supplier tab pattern), matching how
// Supplier Data / Evidence Register present multi-supplier information.
export default function AIEvidenceIntake() {
  const { aiExtractions, aiExtractionRunning, runAIExtraction } = useStore()

  const withPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length > 0)
  const withoutPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length === 0)

  const totalDocs = withPacks.reduce((n, s) => n + getDocumentsForSupplier(s.id).length, 0)
  const runExtractions = Object.values(aiExtractions)
  const claimsExtracted = runExtractions.reduce((n, e) => n + e.claims.length, 0)
  const contradictions = runExtractions.reduce((n, e) => n + e.contradictions.length, 0)

  const runAll = () => withPacks.forEach((s) => runAIExtraction(s.id))

  return (
    <div className="col gap16">
      <div className="info-banner">
        <strong>Evidence Intake</strong>
        <span>
          Supplier documents are classified and their evidence claims extracted, then mapped to evaluation factors.
          Automated extraction is simulated here for demo stability — it makes no scoring or approval decisions, and
          only human-accepted claims flow into validation.
        </span>
      </div>

      <div className="kpi-row">
        <Kpi num={withPacks.length} label="Suppliers with a document pack" accent />
        <Kpi num={totalDocs} label="Documents" />
        <Kpi num={claimsExtracted} label="Claims extracted" />
        <Kpi num={contradictions} label="Contradictions" />
      </div>

      <Card className="card-pad">
        <div className="between wrap gap12">
          <div className="muted" style={{ fontSize: 13, maxWidth: 620 }}>
            Run extraction per supplier below, or process every submitted pack at once. Extraction results become claims
            you review on the <strong>Extracted Claims Review</strong> screen before they reach the validation engine.
          </div>
          <button className="run-extraction-btn" onClick={runAll}>
            <Icon name="sparkle" size={18} /> Run extraction — all packs
          </button>
        </div>
      </Card>

      {withPacks.map((s) => (
        <SupplierIntakeCard
          key={s.id}
          supplierId={s.id}
          supplierName={s.name}
          running={aiExtractionRunning[s.id] ?? false}
          extraction={aiExtractions[s.id]}
          onRun={() => runAIExtraction(s.id)}
        />
      ))}

      {withoutPacks.length > 0 && (
        <Card className="card-pad">
          <div className="section-label">No document pack submitted</div>
          <div className="flex gap16 wrap">
            {withoutPacks.map((s) => (
              <span key={s.id} className="flex center gap8" style={{ fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: SUPPLIER_COLORS[s.id], display: 'inline-block' }} />
                <strong>{s.id}</strong> <span className="muted">{s.name}</span>
              </span>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            These suppliers are still evaluated from their structured Supplier Data; they simply have no document pack to
            extract from in this sample.
          </div>
        </Card>
      )}
    </div>
  )
}

function SupplierIntakeCard({
  supplierId,
  supplierName,
  running,
  extraction,
  onRun,
}: {
  supplierId: string
  supplierName: string
  running: boolean
  extraction: import('../engine/aiTypes').AIExtractionResult | undefined
  onRun: () => void
}) {
  const docs = getDocumentsForSupplier(supplierId)
  const classMap = new Map(classifyDocuments(supplierId).map((c) => [c.documentId, c]))

  return (
    <Card>
      <div className="card-head">
        <div className="flex center gap8">
          <span style={{ width: 12, height: 12, borderRadius: 4, background: SUPPLIER_COLORS[supplierId], display: 'inline-block' }} />
          <div>
            <div className="card-title">{supplierId} · {supplierName}</div>
            <div className="card-hint">{docs.length} documents</div>
          </div>
        </div>
        <button className="run-extraction-btn" onClick={onRun} disabled={running}>
          <Icon name="sparkle" size={16} />
          {running ? 'Extracting…' : extraction ? 'Re-run' : 'Run extraction'}
        </button>
      </div>

      {running ? (
        <div className="extraction-progress">
          <div className="extraction-spinner" />
          <div className="extraction-label">Classifying documents and extracting evidence claims…</div>
          <div className="muted" style={{ fontSize: 12 }}>Simulated extraction for demo stability</div>
        </div>
      ) : (
        <div>
          {docs.map((doc) => (
            <DocumentRow key={doc.documentId} doc={doc} classification={classMap.get(doc.documentId)} />
          ))}
        </div>
      )}

      {extraction && !running && (
        <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap16 wrap" style={{ marginBottom: extraction.contradictions.length || extraction.missingEvidence.length ? 14 : 0 }}>
            <span className="pill pass">{extraction.claims.length} claims extracted</span>
            {extraction.missingEvidence.length > 0 && <span className="pill below">{extraction.missingEvidence.length} missing</span>}
            {extraction.contradictions.length > 0 && <span className="pill critical">{extraction.contradictions.length} contradictions</span>}
          </div>

          {extraction.contradictions.length > 0 && (
            <>
              <div className="section-label">Contradictions detected</div>
              {extraction.contradictions.map((c) => (
                <ContradictionRow key={c.contradictionId} contradiction={c} />
              ))}
            </>
          )}

          {extraction.missingEvidence.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 14 }}>Missing evidence (active factors with no claim)</div>
              {extraction.missingEvidence.map((m) => (
                <MissingEvidenceRow key={m.leafFactorCode} item={m} />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function DocumentRow({ doc, classification }: { doc: UploadedDocument; classification?: DocumentClassification }) {
  return (
    <div className="doc-card">
      <div className="doc-icon">
        <Icon name="document" size={20} />
      </div>
      <div className="doc-info">
        <div className="doc-name">{doc.documentName}</div>
        <div className="doc-meta">
          {doc.pageCount} pages · {doc.fileSizeKB} KB · {doc.documentType}
        </div>
      </div>
      <div className="doc-badges">
        <span className={`doc-extractable ${doc.textExtractable ? 'text' : 'ocr'}`}>
          {doc.textExtractable ? 'Text PDF' : 'OCR needed'}
        </span>
        {classification && classification.coveredDFs.map((df) => (
          <span key={df} className="tag">{df}</span>
        ))}
      </div>
    </div>
  )
}

function MissingEvidenceRow({ item }: { item: MissingEvidence }) {
  return (
    <div className="missing-evidence-item">
      <span className="missing-dot" />
      <span className="mono muted" style={{ fontSize: 12, minWidth: 48 }}>{item.leafFactorCode}</span>
      <strong style={{ fontWeight: 600, flex: 1 }}>{item.leafFactorName}</strong>
      <span className="tag">{item.df}</span>
      <span className={`pill ${item.applicability === 'Mandatory' ? 'mandatory' : 'conditional'}`}>
        {item.applicability}
      </span>
    </div>
  )
}

function ContradictionRow({ contradiction }: { contradiction: Contradiction }) {
  return (
    <div className="contradiction-item">
      <span className={`contradiction-severity ${contradiction.severity.toLowerCase()}`} />
      <div className="contradiction-body">
        <div className="contradiction-desc">{contradiction.description}</div>
        <div className="contradiction-sources">
          <span>A: "{contradiction.claimA.value || '(empty)'}" — {contradiction.claimA.source}</span>
          <span>B: "{contradiction.claimB.value || '(empty)'}" — {contradiction.claimB.source}</span>
        </div>
      </div>
      <span className={`pill ${contradiction.severity === 'High' ? 'critical' : 'watch'}`}>
        {contradiction.severity}
      </span>
    </div>
  )
}
