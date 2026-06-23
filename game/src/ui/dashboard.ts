import type { GameState, DeviceState, Phase, LoseReason } from '../game/state'
import { LIQO2_PER_TANK } from '../game/constants'
import { CTRL_ID } from './controls'

const PHASE_TEXT: Record<Phase, string> = {
  cutscene: '過場 CUTSCENE',
  playing:  '進行中 PLAYING',
  win:      '獲勝 WIN',
  lose:     '失敗 LOSE',
}

const LOSE_TEXT: Record<LoseReason, string> = {
  power:     '電力耗盡 POWER',
  oxygen:    '氧氣耗盡 OXYGEN',
  co2:       '二氧化碳中毒 CO2',
  temp:      '艙溫過低 TEMP',
  deviation: '航道偏離 DEVIATION',
}

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

function setBtnClass(id: string, cls: string, on: boolean): void {
  document.getElementById(id)?.classList.toggle(cls, on)
}

let ampWarnEl: HTMLDivElement | null = null
function getAmpWarn(): HTMLDivElement {
  if (!ampWarnEl) {
    ampWarnEl = document.createElement('div')
    ampWarnEl.id = 'amp-warn'
    ampWarnEl.textContent = '!! 電流超過紅線 AMP OVER REDLINE !!'
    document.body.appendChild(ampWarnEl)
  }
  return ampWarnEl
}

export function render(s: GameState, tick: number): void {
  // ── 文字儀表板 ──────────────────────────────────────────────────────────
  const amp = (s.devices.heater.on ? 3 : 0) +
              (s.devices.co2Filter.on ? 5 : 0) +
              (s.devices.navComp.on ? 4 : 0) +
              (s.o2Releasing ? 2 : 0)

  // 每行開頭固定 2 個中文字，確保數值欄垂直對齊（CJK 偏移每行一致）
  const lines: string[] = [
    `計次 TICK:     ${tick}`,
    ``,
    `倒數 ETA:      ${formatETA(s.eta)}`,
    `主電 PWR:      ${s.mainPwr.toFixed(1)}%`,
    `氧槽 O2 TANK:  ${s.o2Tank.toFixed(1)}%`,
    `液氧 LIQ O2:   ${formatLiqO2(s.liqO2)}`,
    `二氧 CO2:      ${Math.round(s.co2)} PPM`,
    `艙溫 TEMP:     ${s.temp.toFixed(1)}°C`,
    `偏差 DEV:      ${s.devices.navComp.on ? s.dev.toFixed(1) + '%' : 'ERR 離線'}`,
    ``,
    `電流 AMP:      ${amp}A${amp > 10 ? ' ⚠ 超過紅線 OVER REDLINE' : ''}`,
    `階段 PHASE:    ${PHASE_TEXT[s.phase]}${s.loseReason ? ' / ' + LOSE_TEXT[s.loseReason] : ''}`,
    s.brownout ? `** 跳電 BROWNOUT — 點 RESET 復電 **` : '',
  ]
  getDisplay().textContent = lines.join('\n')

  // ── 控制按鈕狀態 ─────────────────────────────────────────────────────────
  const brownout = s.brownout

  const hd = s.devices.heater
  const heaterLocked = s.elapsed < hd.lockUntil
  setBtn(CTRL_ID.heater, `[加熱器 HEATER: ${deviceLabel(hd)}]`, brownout || heaterLocked)
  setBtnClass(CTRL_ID.heater, 'btn-overheat', !brownout && heaterLocked)
  setBtnClass(CTRL_ID.heater, 'btn-degraded', !brownout && !heaterLocked && hd.degraded)

  const fd = s.devices.co2Filter
  const filterLocked = s.elapsed < fd.lockUntil
  setBtn(CTRL_ID.co2Filter, `[濾罐 CO2 FILT: ${deviceLabel(fd)}]`, brownout || filterLocked)
  setBtnClass(CTRL_ID.co2Filter, 'btn-overheat', !brownout && filterLocked)
  setBtnClass(CTRL_ID.co2Filter, 'btn-degraded', !brownout && !filterLocked && fd.degraded)

  const nd = s.devices.navComp
  const navLocked = s.elapsed < nd.lockUntil
  setBtn(CTRL_ID.navComp, `[導航 NAV COMP: ${deviceLabel(nd)}]`, brownout || navLocked)
  setBtnClass(CTRL_ID.navComp, 'btn-overheat', !brownout && navLocked)
  setBtnClass(CTRL_ID.navComp, 'btn-degraded', !brownout && !navLocked && nd.degraded)

  const o2Empty = s.liqO2 <= 0
  setBtn(CTRL_ID.o2Release,
    o2Empty ? '[放氧 O2: EMPTY 耗盡]' : `[放氧 O2 RELEASE${s.o2Releasing ? ' ▼' : '  '}]`,
    brownout || o2Empty)

  // T-064: AMP 紅區閃爍警告
  getAmpWarn().classList.toggle('visible', amp > 10)

  // RESET：跳電才顯示
  const resetEl = document.getElementById(CTRL_ID.reset) as HTMLButtonElement | null
  if (resetEl) resetEl.style.display = brownout ? 'inline-block' : 'none'
}
