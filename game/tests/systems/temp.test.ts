import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { temp } from '../../src/game/systems/temp'
import { FIXED_DT } from '../../src/game/constants'

describe('temp system', () => {
  it('natural cooling: 480s → 4.2°C (GDD 5-E)', () => {
    let s = initialState()
    const steps = Math.round(480 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = temp(s, FIXED_DT)
    // 21 − 0.035×480 = 21 − 16.8 = 4.2
    expect(s.temp).toBeCloseTo(4.2, 1)
  })

  it('heater net rate: +0.065°C/s (heater +0.1, natural −0.035)', () => {
    let s = initialState()
    s.devices.heater.on = true
    s = temp(s, 1)
    expect(s.temp).toBeCloseTo(21 + 0.065, 4)
  })

  it('o2 release cools by 0.6°C/s on top of natural', () => {
    let s = initialState()
    s.o2Releasing = true
    s = temp(s, 1)
    // 21 − 0.035 − 0.6 = 20.365
    expect(s.temp).toBeCloseTo(21 - 0.035 - 0.6, 4)
  })

  it('degraded heater gives +0.06°C/s gross', () => {
    let s = initialState()
    s.devices.heater.on = true
    s.devices.heater.degraded = true
    s = temp(s, 1)
    // 21 + 0.06 − 0.035 = 21.025
    expect(s.temp).toBeCloseTo(21 + 0.06 - 0.035, 4)
  })

  it('temp is not clamped (can go negative, death handled by checkWinLose)', () => {
    let s = initialState()
    s.temp = 0.01
    s = temp(s, 1)
    expect(s.temp).toBeLessThan(0)
  })
})
