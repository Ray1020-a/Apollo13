import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { power } from '../../src/game/systems/power'
import { FIXED_DT } from '../../src/game/constants'

describe('power system', () => {
  it('no devices → no power drain', () => {
    let s = initialState()
    s = power(s, 1)
    expect(s.mainPwr).toBe(100)
  })

  it('9A for 100s consumes 22.5%', () => {
    let s = initialState()
    s.devices.co2Filter.on = true  // 5A
    s.devices.navComp.on = true    // 4A → 9A total
    const steps = Math.round(100 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = power(s, FIXED_DT)
    // 9 × 0.025 × 100 = 22.5%
    expect(s.mainPwr).toBeCloseTo(100 - 22.5, 3)
  })

  it('9A for 480s would consume 108% → drains to 0 (never negative)', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s.devices.navComp.on = true
    const steps = Math.round(480 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = power(s, FIXED_DT)
    // 9A × 0.025 × 480 = 108% → clamped to 0
    expect(s.mainPwr).toBe(0)
  })

  it('3A heater for 1s draws 0.075%', () => {
    let s = initialState()
    s.devices.heater.on = true
    s = power(s, 1)
    expect(s.mainPwr).toBeCloseTo(100 - 0.075, 5)
  })
})
