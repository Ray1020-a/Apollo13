import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { co2 } from '../../src/game/systems/co2'
import { FIXED_DT } from '../../src/game/constants'

describe('co2 system', () => {
  it('starts at 400 PPM', () => {
    const s = initialState()
    expect(s.co2).toBe(400)
  })

  it('without filter reaches 10000 PPM at exactly 480s (GDD 5-D)', () => {
    let s = initialState()
    const steps = Math.round(480 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = co2(s, FIXED_DT)
    // 400 + 20×480 = 10000
    expect(s.co2).toBeCloseTo(10000, 0)
  })

  it('with filter: net −20 PPM/s (rises at 20, filters 40)', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s = co2(s, 1)
    // 400 + 20 − 40 = 380
    expect(s.co2).toBeCloseTo(380, 5)
  })

  it('degraded filter removes only 25 PPM/s (net +5)', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s.devices.co2Filter.degraded = true
    s = co2(s, 1)
    // 400 + 20 − 25 = 395
    expect(s.co2).toBeCloseTo(395, 5)
  })

  it('co2 cannot go below 0', () => {
    let s = initialState()
    s.co2 = 0
    s.devices.co2Filter.on = true
    s = co2(s, 10)
    expect(s.co2).toBe(0)
  })
})
