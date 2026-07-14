import Chip from '@mui/material/Chip'
import type { ChipProps } from '@mui/material/Chip'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningRoundedIcon from '@mui/icons-material/WarningRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import { useTheme } from '@mui/material/styles'
import type {
  ApplicabilityStatus,
  ReadinessLabel,
  ValidationStatus,
} from '../engine/types'
import type {
  AIClaimType,
  ClaimReviewStatus,
  EvidenceQuality,
} from '../engine/aiTypes'

// Single source of truth for status → color across the whole app.
// Pass = green, Watch/Warning = amber, Critical/Missing = red, Locked/NA = gray, Info = blue.
export type StatusTone = 'pass' | 'watch' | 'critical' | 'locked' | 'info'

const TONE_ICON: Record<StatusTone, typeof CheckCircleRoundedIcon> = {
  pass: CheckCircleRoundedIcon,
  watch: WarningRoundedIcon,
  critical: ErrorRoundedIcon,
  locked: LockRoundedIcon,
  info: InfoRoundedIcon,
}

export function StatusBadge({
  label,
  tone,
  icon = true,
  size = 'small',
  variant = 'filled',
}: {
  label: string
  tone: StatusTone
  icon?: boolean
  size?: ChipProps['size']
  variant?: ChipProps['variant']
}) {
  const theme = useTheme()
  const token = theme.palette.status[tone]
  const Ico = TONE_ICON[tone]
  return (
    <Chip
      size={size}
      variant={variant}
      icon={icon ? <Ico style={{ color: token.main }} /> : undefined}
      label={label}
      sx={{
        bgcolor: variant === 'filled' ? token.bg : 'transparent',
        color: token.main,
        border: variant === 'outlined' ? `1px solid ${token.main}` : 'none',
        '& .MuiChip-icon': { color: token.main },
      }}
    />
  )
}

const VALIDATION_TONE: Record<ValidationStatus, StatusTone> = {
  Pass: 'pass',
  Watch: 'watch',
  'Below Threshold': 'critical',
  Missing: 'critical',
  Invalid: 'critical',
  'Critical Flag': 'critical',
  'Not Applicable': 'locked',
}
export function ValidationBadge({ status }: { status: ValidationStatus }) {
  return <StatusBadge label={status} tone={VALIDATION_TONE[status]} />
}

const APPLICABILITY_TONE: Record<ApplicabilityStatus, StatusTone> = {
  Mandatory: 'info',
  Optional: 'locked',
  'Conditional Active': 'watch',
  'Not Applicable': 'locked',
}
export function ApplicabilityBadge({ status }: { status: ApplicabilityStatus }) {
  return <StatusBadge label={status} tone={APPLICABILITY_TONE[status]} />
}

const READINESS_TONE: Record<ReadinessLabel, StatusTone> = {
  'Best-fit Shortlist': 'pass',
  Conditional: 'watch',
  'Needs Review': 'watch',
  'Low Fit': 'critical',
  'Critical Flag / Review': 'critical',
}
export function ReadinessBadge({ label }: { label: ReadinessLabel }) {
  return <StatusBadge label={label} tone={READINESS_TONE[label]} />
}

const CLAIM_REVIEW_TONE: Record<ClaimReviewStatus, StatusTone> = {
  Pending: 'watch',
  Accepted: 'pass',
  Rejected: 'critical',
}
export function ClaimReviewBadge({ status }: { status: ClaimReviewStatus }) {
  return <StatusBadge label={status} tone={CLAIM_REVIEW_TONE[status]} />
}

const QUALITY_TONE: Record<EvidenceQuality, StatusTone> = {
  High: 'pass',
  Medium: 'watch',
  Low: 'critical',
  'N/A': 'locked',
}
export function QualityBadge({ quality }: { quality: EvidenceQuality }) {
  return <StatusBadge label={quality} tone={QUALITY_TONE[quality]} icon={false} />
}

const CLAIM_TYPE_TONE: Record<AIClaimType, StatusTone> = {
  Explicit: 'pass',
  Inferred: 'watch',
  Negative: 'critical',
  Absent: 'locked',
}
export function ClaimTypeBadge({ type }: { type: AIClaimType }) {
  return <StatusBadge label={type} tone={CLAIM_TYPE_TONE[type]} icon={false} />
}
