import type { ReactNode } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

// Generic centered dialog — replaces the app's 2 previously duplicated modal implementations.
export function AppDialog({
  open,
  onClose,
  title,
  actions,
  children,
  maxWidth = 'sm',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle component="div">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {title}
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions sx={{ p: 2 }}>{actions}</DialogActions>}
    </Dialog>
  )
}
