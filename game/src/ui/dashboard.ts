import type { GameState } from '../game/state'
import { LIQO2_PER_TANK } from '../game/constants'

let display: HTMLPreElement | null = null

function getDisplay(): HTMLPreElement {
  if (!display) {
    display = document.createElement('pre')
    document.body.appendChild(display)
  }
  return display
}

function formatETA(metSeconds: number): string {
  const total = Math.max(0, Math.floor(metSeconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatLiqO2(liqO2: number): string {
  const tanks = Math.ceil(liqO2 / LIQO2_PER_TANK)
  return Array.from({ length: 3 }, (_, i) => i < tanks ? '[■]' : '[□]').join('')
}

export function render(s: GameState, tick: number): void {
  const d = getDisplay()
  const lines = [
    `tick:     ${tick}`,
    ``,
    `ETA:      ${formatETA(s.eta)}`,
    `MAIN PWR: ${s.mainPwr.toFixed(1)}%`,
    `O2 TANK:  ${s.o2Tank.toFixed(1)}%`,
    `LIQ O2:   ${formatLiqO2(s.liqO2)}`,
    `CO2 LVL:  ${Math.round(s.co2)} PPM`,
    `TEMP:     ${s.temp.toFixed(1)}°C`,
    `DEV:      ${s.devices.navComp.on ? s.dev.toFixed(1) + '%' : 'ERR'}`,
    ``,
    `AMP:      ${
      (s.devices.heater.on ? 3 : 0) +
      (s.devices.co2Filter.on ? 5 : 0) +
      (s.devices.navComp.on ? 4 : 0) +
      (s.o2Releasing ? 2 : 0)
    }A`,
    `HEATER:   ${s.devices.heater.on ? 'ON ' : 'off'}${s.devices.heater.degraded ? ' [!]' : ''}`,
    `CO2 FILT: ${s.devices.co2Filter.on ? 'ON ' : 'off'}${s.devices.co2Filter.degraded ? ' [!]' : ''}`,
    `NAV COMP: ${s.devices.navComp.on ? 'ON ' : 'off'}${s.devices.navComp.degraded ? ' [!]' : ''}`,
    s.brownout ? `** BROWNOUT — CLICK RESET **` : '',
    `phase:    ${s.phase}`,
  ]
  d.textContent = lines.join('\n')
}
