import type { ReactNode } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

// Generic right-side detail drawer — replaces the app's 3 previously duplicated
// drawer implementations (trace / evidence / claim detail).
export function AppDrawer({
  open,
  onClose,
  title,
  subtitle,
  width = 420,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  width?: number
  children: ReactNode
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width, maxWidth: '92vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ p: 2.5, pb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>{children}</Box>
      </Box>
    </Drawer>
  )
}
