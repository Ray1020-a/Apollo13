/**
 * T-061: CO2 黑暈 vignette overlay
 *
 * Pure DOM/CSS layer — reads GameState thresholds from constants, zero game logic.
 * Called once per RAF frame from loop.ts after render().
 */
import type { GameState } from '../game/state'
import { CO2_VIGNETTE, CO2_LETHAL } from '../game/constants'

let vignette: HTMLDivElement | null = null

function getVignette(): HTMLDivElement {
  if (!vignette) {
    vignette = document.createElement('div')
    Object.assign(vignette.style, {
      position:      'fixed',
      inset:         '0',
      pointerEvents: 'none',
      zIndex:        '100',
      background:    'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.95) 100%)',
      opacity:       '0',
      transition:    'opacity 0.5s ease',
    })
    document.body.appendChild(vignette)
  }
  return vignette
}

export function updateVignette(s: GameState): void {
  const el = getVignette()
  if (s.co2 <= CO2_VIGNETTE) {
    el.style.opacity = '0'
    return
  }
  // linear 0→1 from CO2_VIGNETTE(5000) to CO2_LETHAL(10000)
  const t = Math.min(1, (s.co2 - CO2_VIGNETTE) / (CO2_LETHAL - CO2_VIGNETTE))
  el.style.opacity = t.toFixed(3)
}
