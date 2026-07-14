import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'

// Shared full-screen layout for the three pre-shell gate screens (Login, Select Use
// Case, Select Component) — centered brand, a 1-2-3 progress dots row, title/subtitle,
// content, and a sticky footer action.
export function GateLayout({
  step,
  title,
  subtitle,
  children,
  footer,
}: {
  step: 1 | 2 | 3
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 6 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            S
          </Box>
          <Typography variant="subtitle1" fontWeight={800}>
            Supplier Evaluation Engine
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={0.75}>
            {[1, 2, 3].map((n) => (
              <Box
                key={n}
                sx={{
                  width: n === step ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: n <= step ? 'primary.main' : '#E4E7EC',
                  transition: 'width 0.15s ease',
                }}
              />
            ))}
          </Stack>
        </Stack>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
            {subtitle}
          </Typography>
        )}

        <Box sx={{ flex: 1 }}>{children}</Box>

        {footer && (
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4, pt: 3, borderTop: '1px solid #E4E7EC' }}>
            {footer}
          </Stack>
        )}
      </Container>
    </Box>
  )
}
