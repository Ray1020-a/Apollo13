import type { GameState, DeviceId } from '../state'
import { computeAmp } from '../state'
import {
  AMP_REDLINE, BROWNOUT_SECONDS, BROWNOUT_PWR_PENALTY, BROWNOUT_DEGRADE_CHANCE,
  OVERHEAT_LIMIT, OVERHEAT_COOL_RATE, LOCK_SECONDS,
} from '../constants'

const DEVICE_IDS: DeviceId[] = ['heater', 'co2Filter', 'navComp']

export function devices(s: GameState, dt: number): GameState {
  const amp = computeAmp(s)

  if (!s.brownout) {
    s.ampOverRedSeconds = amp > AMP_REDLINE ? s.ampOverRedSeconds + dt : 0
    if (s.ampOverRedSeconds >= BROWNOUT_SECONDS) {
      s.brownout = true
      for (const id of DEVICE_IDS) s.devices[id].on = false
      s.mainPwr = Math.max(0, s.mainPwr - BROWNOUT_PWR_PENALTY)
      if (s.lastDeviceOn && s.rng() < BROWNOUT_DEGRADE_CHANCE)
        s.devices[s.lastDeviceOn].degraded = true
      s.ampOverRedSeconds = 0
    }
  }

  for (const id of DEVICE_IDS) {
    const d = s.devices[id]
    const locked = s.elapsed < d.lockUntil
    if (d.on && !locked) d.heat += dt
    else d.heat = Math.max(0, d.heat - OVERHEAT_COOL_RATE * dt)
    if (d.heat >= OVERHEAT_LIMIT[id]) {
      d.on = false
      d.lockUntil = s.elapsed + LOCK_SECONDS
    }
  }

  return s
}
