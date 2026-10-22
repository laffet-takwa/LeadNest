/**
 * Chart theming.
 *
 * Recharts writes its colours into SVG presentation attributes, which cannot
 * reliably use CSS custom properties. The tokens are therefore resolved from
 * the stylesheet at runtime, so the chart still follows the active theme and
 * the values are only ever declared in `tokens.css`.
 */

import { useEffect, useState } from 'react'

import { useTheme } from '@/app/theme-context'

export interface ChartTokens {
  /** The grid lines. */
  grid: string
  /** The axis labels. */
  axis: string
  /** The border of the tooltip. */
  border: string
  /** The highlight behind the hovered bar. */
  cursor: string
  /** The tooltip shadow. */
  shadow: string
  /** The tooltip surface. */
  surface: string
  /** The tooltip text. */
  foreground: string
}

const FALLBACK: ChartTokens = {
  grid: 'hsl(222 33% 92%)',
  axis: 'hsl(221 13% 46%)',
  border: 'hsl(222 33% 92%)',
  cursor: 'hsl(227 100% 97%)',
  shadow: '0 12px 16px -4px rgb(16 24 40 / 0.08)',
  surface: 'hsl(0 0% 100%)',
  foreground: 'hsl(221 38% 15%)',
}

function readTokens(): ChartTokens {
  if (typeof window === 'undefined') return FALLBACK
  const styles = window.getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim()
    return value === '' ? fallback : value
  }
  return {
    grid: `hsl(${read('--border', '222 33% 92%')})`,
    axis: `hsl(${read('--ink-secondary', '221 13% 46%')})`,
    border: `hsl(${read('--border', '222 33% 92%')})`,
    cursor: `hsl(${read('--brand-soft', '227 100% 97%')})`,
    shadow: read('--shadow-lg', FALLBACK.shadow),
    surface: `hsl(${read('--surface', '0 0% 100%')})`,
    foreground: `hsl(${read('--ink', '221 38% 15%')})`,
  }
}

/** The chart colours for the active theme. */
export function useChartTokens(): ChartTokens {
  const { resolved } = useTheme()
  // The tokens are read during the first render rather than in an effect, so
  // the chart is painted with the right colours straight away instead of
  // flashing the light palette.
  const [tokens, setTokens] = useState<ChartTokens>(readTokens)

  useEffect(() => {
    setTokens(readTokens())
  }, [resolved])

  return tokens
}
