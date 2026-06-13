import type { GameState } from '../state'
import { CO2_RISE, CO2_FILTER_REMOVE, CO2_FILTER_REMOVE_DEGRADED } from '../constants'

export function co2(s: GameState, dt: number): GameState {
  s.co2 += CO2_RISE * dt

  if (s.devices.co2Filter.on) {
    const rate = s.devices.co2Filter.degraded
      ? CO2_FILTER_REMOVE_DEGRADED
      : CO2_FILTER_REMOVE
    s.co2 -= rate * dt
  }

  s.co2 = Math.max(0, s.co2)
  return s
}
