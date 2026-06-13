import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { checkWinLose } from '../../src/game/systems/checkWinLose'
import { CO2_LETHAL, DEV_LETHAL } from '../../src/game/constants'

describe('checkWinLose', () => {
  it('no change while all values safe', () => {
    const s = checkWinLose(initialState())
    expect(s.phase).toBe('playing')
    expect(s.loseReason).toBeNull()
  })

  it('MAIN PWR ≤ 0 → lose / power (GDD §4)', () => {
    const s = initialState()
    s.mainPwr = 0
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('power')
  })

  it('O2 TANK ≤ 0 → lose / oxygen', () => {
    const s = initialState()
    s.o2Tank = 0
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('oxygen')
  })

  it('CO2 ≥ 10000 PPM → lose / co2', () => {
    const s = initialState()
    s.co2 = CO2_LETHAL
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('co2')
  })

  it('TEMP ≤ 0°C → lose / temp', () => {
    const s = initialState()
    s.temp = 0
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('temp')
  })

  it('DEV > 50% → lose / deviation', () => {
    const s = initialState()
    s.dev = DEV_LETHAL + 0.01
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('deviation')
  })

  it('DEV exactly 50 is NOT lethal (must be strictly >)', () => {
    const s = initialState()
    s.dev = DEV_LETHAL
    const r = checkWinLose(s)
    expect(r.phase).toBe('playing')
  })

  it('ETA ≤ 0 and mainPwr > 0 → win (GDD §4)', () => {
    const s = initialState()
    s.eta = 0
    const r = checkWinLose(s)
    expect(r.phase).toBe('win')
  })

  it('ETA ≤ 0 but mainPwr = 0 → lose / power, not win', () => {
    const s = initialState()
    s.eta = 0
    s.mainPwr = 0
    const r = checkWinLose(s)
    expect(r.phase).toBe('lose')
    expect(r.loseReason).toBe('power')
  })

  it('non-playing phase is skipped (idempotent)', () => {
    const s = initialState()
    s.phase = 'win'
    s.mainPwr = 0  // would normally trigger lose
    const r = checkWinLose(s)
    expect(r.phase).toBe('win')  // unchanged
  })

  it('power checked before oxygen (priority order)', () => {
    const s = initialState()
    s.mainPwr = 0
    s.o2Tank = 0
    const r = checkWinLose(s)
    expect(r.loseReason).toBe('power')
  })
})
