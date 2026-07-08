// ---------------------------------------------------------------------------
// AI Evidence Intake — mock extraction orchestrator.
//
// In demo mode (the only mode for this prototype), all extraction results come
// from pre-built JSON fixtures. The module exposes the same API that a real
// AI-backed service would, so the UI code is integration-ready.
//
// The orchestrator chains:
//   classifyDocuments → extractClaims → detectMissingEvidence → detectContradictions
// ---------------------------------------------------------------------------

import type {
  AIClaim,
  AIExtractionResult,
  Contradiction,
  DocumentClassification,
  MissingEvidence,
  UploadedDocument,
} from './aiTypes'
import type { DFCode, FactorApplicability } from './types'

import uploadManifest from '../data/upload_manifest.json'
import mockClaims from '../data/mock_ai_extracted_claims.json'
import expectedContradictions from '../data/expected_contradictions.json'
import expectedClassifications from '../data/expected_document_classifications.json'
import leafFactors from '../data/leafFactors.json'

// --- Public: get uploaded documents for a supplier -------------------------
export function getDocumentsForSupplier(supplierId: string): UploadedDocument[] {
  return (uploadManifest as UploadedDocument[]).filter((d) => d.supplierId === supplierId)
}

// --- Public: classify documents --------------------------------------------
export function classifyDocuments(supplierId: string): DocumentClassification[] {
  const docIds = new Set(getDocumentsForSupplier(supplierId).map((d) => d.documentId))
  return (expectedClassifications as DocumentClassification[]).filter((c) => docIds.has(c.documentId))
}

// --- Public: extract claims for a supplier (mock) --------------------------
export function extractClaims(supplierId: string): AIClaim[] {
  return (mockClaims as AIClaim[]).filter((c) => c.supplierId === supplierId)
}

// --- Public: detect missing evidence ---------------------------------------
export function detectMissingEvidence(
  _supplierId: string,
  claims: AIClaim[],
  applicability: FactorApplicability[],
): MissingEvidence[] {
  // Active factors = Mandatory or Conditional Active
  const active = applicability.filter(
    (a) => a.status === 'Mandatory' || a.status === 'Conditional Active',
  )

  // Fields that have at least one non-absent claim
  const coveredFields = new Set(
    claims.filter((c) => c.claimType !== 'Absent' && c.claimValue !== '').map((c) => c.backendField),
  )

  return active
    .filter((a) => !coveredFields.has(a.field))
    .map((a) => ({
      leafFactorCode: a.code,
      leafFactorName: a.name,
      field: a.field,
      df: a.df as DFCode,
      applicability: a.status,
    }))
}

// --- Public: detect contradictions -----------------------------------------
export function detectContradictions(supplierId: string): Contradiction[] {
  return (expectedContradictions as Contradiction[]).filter((c) => c.supplierId === supplierId)
}

// --- Public: full extraction orchestrator ----------------------------------
export function runFullExtraction(
  supplierId: string,
  applicability: FactorApplicability[],
): AIExtractionResult {
  const claims = extractClaims(supplierId)
  const contradictions = detectContradictions(supplierId)
  const missingEvidence = detectMissingEvidence(supplierId, claims, applicability)
  const documentClassifications = classifyDocuments(supplierId)

  return {
    supplierId,
    claims,
    contradictions,
    missingEvidence,
    documentClassifications,
    extractedAt: new Date().toISOString(),
  }
}

// --- Helpers for UI --------------------------------------------------------
export function getAllSupplierIds(): string[] {
  const ids = new Set((uploadManifest as UploadedDocument[]).map((d) => d.supplierId))
  return Array.from(ids).sort()
}

export function getLeafFactorName(code: string): string {
  const lf = leafFactors.find((f) => f.code === code)
  return lf?.name ?? code
}

export function getDFName(dfCode: string): string {
  const names: Record<string, string> = {
    DF1: 'Technical Capability',
    DF2: 'Capacity & Scalability',
    DF3: 'Quality',
    DF4: 'Delivery & Logistics',
    DF5: 'Financial Stability',
    DF6: 'Compliance & ESG',
    DF7: 'Risk & Resilience',
  }
  return names[dfCode] ?? dfCode
}

// Identity/context backend fields that were never meant to enter scoring.
const IDENTITY_FIELDS = new Set(['legal_corporate_name', 'duns_number', 'plant_address', 'quality_contact'])

export interface ClaimMapping {
  scored: boolean
  dfLabel: string // "DF3 · Quality" (scored only)
  lfLabel: string // "LF3.6 · PPAP & Launch Capability" (scored only)
  notScoredLabel: string // single, honest label for non-scored claims
}

// A claim is "scored" only when it maps to a real DF1–DF7 AND a real LF code from
// leafFactors.json whose df matches — i.e. a canonical factor the engine actually scores.
// Everything else (identity placeholders like "Supplier Master", or a real DF paired with a
// non-code leaf label) is informational and is labelled as not-scored, never as a fabricated factor.
export function describeClaimMapping(claim: AIClaim): ClaimMapping {
  const df = claim.mappedDecisionFactor
  const lf = claim.mappedLeafFactor
  const leaf = leafFactors.find((l) => l.code === lf)
  const scored = /^DF[1-7]$/.test(df) && !!leaf && leaf.df === df
  const notScoredLabel = IDENTITY_FIELDS.has(claim.backendField)
    ? 'Not scored — supplier identity'
    : 'Not scored — supplementary evidence'
  return { scored, dfLabel: `${df} · ${getDFName(df)}`, lfLabel: `${lf} · ${getLeafFactorName(lf)}`, notScoredLabel }
}
