/**
 * T-061: CO2 黑暈 vignette overlay
 * T-062: TEMP 霜花 frost overlay
 *
 * Pure DOM/CSS layer — reads GameState thresholds from constants, zero game logic.
 * Called once per RAF frame from loop.ts after render().
 */
import type { GameState } from '../game/state'
import { CO2_VIGNETTE, CO2_LETHAL, TEMP_FROST, TEMP_FROST_HEAVY } from '../game/constants'

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

// ── T-062: Frost ─────────────────────────────────────────────────────────────

let frost: HTMLDivElement | null = null
let frostHeavy: HTMLDivElement | null = null

function getFrost(): HTMLDivElement {
  if (!frost) {
    frost = document.createElement('div')
    Object.assign(frost.style, {
      position:      'fixed',
      inset:         '0',
      pointerEvents: 'none',
      zIndex:        '101',
      // white crystalline edge — inward blur via box-shadow on ::before would need class;
      // use a simple radial from white edges to transparent center
      background:    'radial-gradient(ellipse at center, transparent 35%, rgba(180,220,255,0.6) 100%)',
      opacity:       '0',
      transition:    'opacity 0.8s ease',
    })
    document.body.appendChild(frost)
  }
  return frost
}

function getFrostHeavy(): HTMLDivElement {
  if (!frostHeavy) {
    frostHeavy = document.createElement('div')
    Object.assign(frostHeavy.style, {
      position:        'fixed',
      inset:           '0',
      pointerEvents:   'none',
      zIndex:          '102',
      background:      'radial-gradient(ellipse at center, transparent 20%, rgba(200,230,255,0.85) 80%, rgba(220,240,255,0.95) 100%)',
      opacity:         '0',
      transition:      'opacity 0.8s ease',
      backdropFilter:  'blur(2px)',
    })
    document.body.appendChild(frostHeavy)
  }
  return frostHeavy
}

export function updateFrost(s: GameState): void {
  const light = getFrost()
  const heavy = getFrostHeavy()

  if (s.temp >= TEMP_FROST) {
    light.style.opacity = '0'
    heavy.style.opacity = '0'
    return
  }

  if (s.temp >= TEMP_FROST_HEAVY) {
    // TEMP_FROST_HEAVY(5) ≤ temp < TEMP_FROST(10): light frost, linear 0→1
    const t = (TEMP_FROST - s.temp) / (TEMP_FROST - TEMP_FROST_HEAVY)
    light.style.opacity = t.toFixed(3)
    heavy.style.opacity = '0'
  } else {
    // temp < TEMP_FROST_HEAVY(5): light frost full + heavy frost growing
    light.style.opacity = '1'
    const t = Math.min(1, (TEMP_FROST_HEAVY - s.temp) / TEMP_FROST_HEAVY)
    heavy.style.opacity = t.toFixed(3)
  }
}

// ── T-061: Vignette ───────────────────────────────────────────────────────────

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
