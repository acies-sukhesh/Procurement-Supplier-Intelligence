import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import { SUPPLIER_COLORS } from '../theme'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function SupplierAvatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  const bg = SUPPLIER_COLORS[id] ?? '#5B6472'
  return (
    <Avatar sx={{ bgcolor: bg, width: size, height: size, fontSize: size * 0.4, fontWeight: 700 }}>
      {initials(name)}
    </Avatar>
  )
}

export function SupplierChip({ id, name, onClick, selected }: { id: string; name: string; onClick?: () => void; selected?: boolean }) {
  const bg = SUPPLIER_COLORS[id] ?? '#5B6472'
  return (
    <Chip
      avatar={<Avatar sx={{ bgcolor: bg }}>{initials(name)}</Avatar>}
      label={name}
      onClick={onClick}
      variant={selected ? 'filled' : 'outlined'}
      color={selected ? 'primary' : undefined}
      sx={{ fontWeight: 600 }}
    />
  )
}
