import type { GameState, LoseReason } from '../state'
import { CO2_LETHAL, TEMP_LETHAL, DEV_LETHAL } from '../constants'

export function checkWinLose(s: GameState): GameState {
  if (s.phase !== 'playing') return s

  let reason: LoseReason | null = null
  if (s.mainPwr <= 0)       reason = 'power'
  else if (s.o2Tank <= 0)   reason = 'oxygen'
  else if (s.co2 >= CO2_LETHAL) reason = 'co2'
  else if (s.temp <= TEMP_LETHAL) reason = 'temp'
  else if (s.dev > DEV_LETHAL) reason = 'deviation'

  if (reason) {
    s.phase = 'lose'
    s.loseReason = reason
    return s
  }

  if (s.eta <= 0 && s.mainPwr > 0) s.phase = 'win'
  return s
}
