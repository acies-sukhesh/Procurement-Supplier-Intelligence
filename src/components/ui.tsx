import type { ReactNode } from 'react'
import type { ApplicabilityStatus, ReadinessLabel, ValidationStatus } from '../engine/types'
import type { AIClaimType, ClaimReviewStatus, EvidenceQuality } from '../engine/aiTypes'

// --- Minimal stroke icon set ---
export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'nav-ico' }
  switch (name) {
    case 'request': return <svg {...p}><path d="M4 4h16v5H4zM4 13h10v7H4zM17 13h3v7h-3z" /></svg>
    case 'rules': return <svg {...p}><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="2" /></svg>
    case 'dictionary': return <svg {...p}><path d="M5 4h13a1 1 0 0 1 1 1v15H6a1 1 0 0 1-1-1zM9 8h6M9 12h6" /></svg>
    case 'data': return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 9h16M4 14h16M10 4v16" /></svg>
    case 'checklist': return <svg {...p}><path d="M9 5h10M9 12h10M9 19h10" /><path d="M4 5l1.5 1.5L8 4M4 12l1.5 1.5L8 11" /></svg>
    case 'validation': return <svg {...p}><path d="M4 12l4 4 12-12" /><path d="M4 19h16" /></svg>
    case 'aggregation': return <svg {...p}><path d="M12 3l8 5v8l-8 5-8-5V8z" /><path d="M12 8v8M8 10v4M16 10v4" /></svg>
    case 'comparison': return <svg {...p}><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
    case 'scenario': return <svg {...p}><path d="M8 4v16M16 4v16" /><path d="M4 8h8M12 16h8" /></svg>
    case 'summary': return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 9l2 2 3-4M8 15l2 2 3-4" /></svg>
    case 'chevron': return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>
    case 'close': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
    case 'flag': return <svg {...p}><path d="M5 21V4h11l-2 4 2 4H5" /></svg>
    case 'check': return <svg {...p}><path d="M5 12l4 4 10-11" /></svg>
    case 'up': return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
    case 'down': return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
    // Evidence intake / review icons
    case 'intake': return <svg {...p}><rect x="4" y="4" width="12" height="16" rx="1" /><path d="M8 9h4M8 13h4" /><path d="M19 4v6M16 7h6" /></svg>
    case 'review': return <svg {...p}><path d="M4 6h16M4 10h16M4 14h10M4 18h8" /><circle cx="18" cy="16" r="3" /><path d="M20.5 18.5l1.5 1.5" /></svg>
    case 'edit': return <svg {...p}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
    case 'accept': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
    case 'reject': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
    case 'sparkle': return <svg {...p}><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" fill="var(--accent)" stroke="var(--accent)" /></svg>
    case 'document': return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
    case 'warning': return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>
  }
}

const VAL_CLASS: Record<ValidationStatus, string> = {
  Pass: 'pass', Watch: 'watch', 'Below Threshold': 'below', Missing: 'missing',
  Invalid: 'invalid', 'Critical Flag': 'critical', 'Not Applicable': 'na',
}

export function StatusPill({ status }: { status: ValidationStatus }) {
  return <span className={`pill dot ${VAL_CLASS[status]}`}>{status}</span>
}

const APP_CLASS: Record<ApplicabilityStatus, string> = {
  Mandatory: 'mandatory', Optional: 'optional', 'Conditional Active': 'conditional', 'Not Applicable': 'na',
}
export function ApplicabilityPill({ status }: { status: ApplicabilityStatus }) {
  return <span className={`pill ${APP_CLASS[status]}`}>{status}</span>
}

const LABEL_CLASS: Record<ReadinessLabel, string> = {
  'Best-fit Shortlist': 'pass', Conditional: 'conditional', 'Needs Review': 'watch',
  'Low Fit': 'below', 'Critical Flag / Review': 'critical',
}
export function LabelPill({ label }: { label: ReadinessLabel }) {
  return <span className={`pill ${LABEL_CLASS[label]}`}>{label}</span>
}

export function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`card ${className}`}>{children}</div>
}

export function Kpi({ num, label, accent = false }: { num: ReactNode; label: string; accent?: boolean }) {
  return (
    <div className={`kpi ${accent ? 'kpi-accent' : ''}`}>
      <div className="kpi-num">{num}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}

// --- AI Evidence Intake components -----------------------------------------

const CLAIM_TYPE_CLASS: Record<AIClaimType, string> = {
  Explicit: 'explicit',
  Inferred: 'inferred',
  Negative: 'negative',
  Absent: 'absent',
}
export function ClaimTypePill({ type }: { type: AIClaimType }) {
  return <span className={`pill claim-type ${CLAIM_TYPE_CLASS[type]}`}>{type}</span>
}

const QUALITY_CLASS: Record<EvidenceQuality, string> = {
  High: 'quality-high',
  Medium: 'quality-medium',
  Low: 'quality-low',
  'N/A': 'na', // reuses the existing neutral pill style
}
export function QualityPill({ quality }: { quality: EvidenceQuality }) {
  return <span className={`pill ${QUALITY_CLASS[quality]}`}>{quality}</span>
}

const REVIEW_CLASS: Record<ClaimReviewStatus, string> = {
  Pending: 'review-pending',
  Accepted: 'review-accepted',
  Rejected: 'review-rejected',
}
export function ReviewStatusPill({ status }: { status: ClaimReviewStatus }) {
  return <span className={`pill ${REVIEW_CLASS[status]}`}>{status}</span>
}

export function ConfidenceBar({ value, width = 80 }: { value: number; width?: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.85 ? 'var(--pass)' : value >= 0.6 ? 'var(--watch)' : 'var(--below)'
  return (
    <div className="confidence-bar" style={{ width }}>
      <div className="confidence-track">
        <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="confidence-label">{pct}%</span>
    </div>
  )
}

// Supplier color scale used consistently across charts.
export const SUPPLIER_COLORS: Record<string, string> = {
  'SUP-A': '#2f6d8f', 'SUP-B': '#b8860b', 'SUP-C': '#8b6f47', 'SUP-D': '#4a7c59', 'SUP-E': '#9a4b3f',
}
