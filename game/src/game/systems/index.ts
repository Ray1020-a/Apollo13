import type { GameState } from '../state'
import { devices } from './devices'
import { power } from './power'
import { oxygen } from './oxygen'
import { temp } from './temp'
import { co2 } from './co2'
import { nav } from './nav'

// 執行順序鎖定：D-007
// elapsed 先加，系統按序執行
export function step(s: GameState, dt: number): GameState {
  s.elapsed += dt
  s = devices(s, dt)
  s = power(s, dt)
  s = oxygen(s, dt)
  s = temp(s, dt)
  s = co2(s, dt)
  s = nav(s, dt)
  // checkWinLose 在 T-030（Phase 3）加入
  return s
}
