import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { StatusTone } from './StatusBadge'

export function KpiTile({
  value,
  label,
  icon,
  tone,
}: {
  value: ReactNode
  label: string
  icon?: ReactNode
  tone?: StatusTone
}) {
  const theme = useTheme()
  const color = tone ? theme.palette.status[tone].main : theme.palette.primary.main
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderRadius: 3, flex: 1, minWidth: 140, borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {icon && (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: tone ? theme.palette.status[tone].bg : 'rgba(22,87,201,0.08)',
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.15}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {children}
    </Stack>
  )
}
