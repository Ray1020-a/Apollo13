import type { GameState } from '../state'
import { computeAmp } from '../state'
import { PWR_PER_AMP_SEC } from '../constants'

export function power(s: GameState, dt: number): GameState {
  s.mainPwr = Math.max(0, s.mainPwr - computeAmp(s) * PWR_PER_AMP_SEC * dt)
  return s
}
