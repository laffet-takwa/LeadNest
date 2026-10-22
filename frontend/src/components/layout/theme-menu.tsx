/**
 * The theme picker.
 *
 * It lives in the account menu so the theme can be changed from any screen
 * without opening the settings, and the same control is reused on the
 * appearance card in the settings.
 */

import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme, type ThemePreference } from '@/app/theme-context'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/overlays'

const OPTIONS: {
  value: ThemePreference
  label: string
  icon: typeof Sun
  description: string
}[] = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Always use the light theme' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Always use the dark theme' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Follow the device setting' },
]

/** The radio group used in the account menu. */
export function ThemeMenuItems({ onSelect }: { onSelect?: () => void }) {
  const { preference, setPreference } = useTheme()

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(value) => {
          setPreference(value as ThemePreference)
          onSelect?.()
        }}
      >
        {OPTIONS.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            <option.icon className="size-4 text-ink-secondary" aria-hidden="true" />
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}
