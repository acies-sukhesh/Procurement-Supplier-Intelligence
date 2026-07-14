import type { ReactNode } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export function SectionCard({
  title,
  hint,
  icon,
  action,
  children,
  dense = false,
  sx,
}: {
  title?: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  dense?: boolean
  sx?: object
}) {
  return (
    <Card sx={sx}>
      <CardContent sx={{ p: dense ? 2 : 3, '&:last-child': { pb: dense ? 2 : 3 } }}>
        {(title || action) && (
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: hint ? 0.5 : 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              {icon && (
                <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{icon}</Box>
              )}
              {title && (
                <Typography variant="subtitle1" fontWeight={700}>
                  {title}
                </Typography>
              )}
            </Stack>
            {action}
          </Stack>
        )}
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {hint}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
