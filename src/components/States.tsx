import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import InboxRoundedIcon from '@mui/icons-material/InboxRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'

// Standardized per-screen states — icon + one line + optional action — used in
// place of ad hoc paragraphs whenever a screen has nothing, is working, or failed.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
      <Box sx={{ color: 'text.disabled', fontSize: 40, display: 'flex' }}>
        {icon ?? <InboxRoundedIcon fontSize="inherit" />}
      </Box>
      <Typography variant="subtitle2" color="text.primary" fontWeight={700}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, color: 'text.secondary' }}>
      <CircularProgress size={28} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
      <Box sx={{ color: 'status.critical.main', fontSize: 40, display: 'flex' }}>
        <ErrorOutlineRoundedIcon fontSize="inherit" color="error" />
      </Box>
      <Typography variant="subtitle2" fontWeight={700}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  )
}
