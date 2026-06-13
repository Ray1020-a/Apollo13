import type { DeviceId } from './state'
import { initialState } from './state'
import { FIXED_DT, MAX_FRAME } from './constants'
import { step } from './systems/index'
import { render } from '../ui/dashboard'
import { updateVignette, updateFrost, updateCursorDrift } from '../ui/effects'

let state = initialState()
let last = performance.now()
let acc = 0
let tick = 0

function frame(now: number): void {
  acc += Math.min((now - last) / 1000, MAX_FRAME)
  last = now
  while (acc >= FIXED_DT) {
    state = step(state, FIXED_DT)
    tick++
    acc -= FIXED_DT
  }
  render(state, tick)
  updateVignette(state)
  updateFrost(state)
  updateCursorDrift(state)
  requestAnimationFrame(frame)
}

export function startLoop(): void {
  requestAnimationFrame(frame)
}

// ── 輸入 handlers（SPEC_DECISIONS 輸入規則）──────────────────────────────────

export function toggleDevice(id: DeviceId): void {
  const d = state.devices[id]
  if (state.brownout) return
  if (state.elapsed < d.lockUntil) return
  const wasOff = !d.on
  d.on = !d.on
  if (wasOff && d.on) state.lastDeviceOn = id
}

export function setO2Held(held: boolean): void {
  if (held && state.brownout) return
  state.o2Held = held
}

export function doReset(): void {
  if (!state.brownout) return
  state.brownout = false
}
