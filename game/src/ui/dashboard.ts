import type { GameState, DeviceState } from '../game/state'
import { LIQO2_PER_TANK } from '../game/constants'
import { CTRL_ID } from './controls'

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
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatLiqO2(liqO2: number): string {
  const tanks = Math.ceil(liqO2 / LIQO2_PER_TANK)
  return Array.from({ length: 3 }, (_, i) => i < tanks ? '[■]' : '[□]').join('')
}

function deviceLabel(d: DeviceState): string {
  const state = d.on ? 'ON ' : 'off'
  const flag  = d.degraded ? '[!]' : '   '
  return `${state} ${flag}`
}

function setBtn(id: string, text: string, dim: boolean, color?: string): void {
  const el = document.getElementById(id) as HTMLButtonElement | null
  if (!el) return
  el.textContent = text
  el.style.opacity = dim ? '0.3' : '1'
  if (color) el.style.color = color
}

export function render(s: GameState, tick: number): void {
  // ── 文字儀表板 ──────────────────────────────────────────────────────────
  const amp = (s.devices.heater.on ? 3 : 0) +
              (s.devices.co2Filter.on ? 5 : 0) +
              (s.devices.navComp.on ? 4 : 0) +
              (s.o2Releasing ? 2 : 0)

  const lines: string[] = [
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
    `AMP:      ${amp}A${amp > 10 ? ' ⚠ OVER REDLINE' : ''}`,
    `phase:    ${s.phase}${s.loseReason ? ' / ' + s.loseReason : ''}`,
    s.brownout ? `** BROWNOUT — CLICK RESET **` : '',
  ]
  getDisplay().textContent = lines.join('\n')

  // ── 控制按鈕狀態 ─────────────────────────────────────────────────────────
  const brownout = s.brownout

  const hd = s.devices.heater
  setBtn(CTRL_ID.heater,
    `[HEATER: ${deviceLabel(hd)}]`,
    brownout || s.elapsed < hd.lockUntil)

  const fd = s.devices.co2Filter
  setBtn(CTRL_ID.co2Filter,
    `[CO2 FILT: ${deviceLabel(fd)}]`,
    brownout || s.elapsed < fd.lockUntil)

  const nd = s.devices.navComp
  setBtn(CTRL_ID.navComp,
    `[NAV COMP: ${deviceLabel(nd)}]`,
    brownout || s.elapsed < nd.lockUntil)

  const o2Empty = s.liqO2 <= 0
  setBtn(CTRL_ID.o2Release,
    o2Empty ? '[O2: EMPTY]' : `[O2 RELEASE${s.o2Releasing ? ' ▼' : '  '}]`,
    brownout || o2Empty)

  // RESET：跳電才顯示
  const resetEl = document.getElementById(CTRL_ID.reset) as HTMLButtonElement | null
  if (resetEl) resetEl.style.display = brownout ? 'inline-block' : 'none'
}
