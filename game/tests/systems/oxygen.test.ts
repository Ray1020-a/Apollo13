import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { oxygen } from '../../src/game/systems/oxygen'
import { FIXED_DT } from '../../src/game/constants'

describe('oxygen system', () => {
  it('natural depletion rate: ~556s to exhaustion (D-006)', () => {
    let s = initialState()
    // 100 ÷ 0.18 = 555.56s
    const steps = Math.round(556 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = oxygen(s, FIXED_DT)
    expect(s.o2Tank).toBeCloseTo(0, 0)
  })

  it('o2Tank cannot go below 0', () => {
    let s = initialState()
    const steps = Math.round(700 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = oxygen(s, FIXED_DT)
    expect(s.o2Tank).toBe(0)
  })

  it('10s press: +8% gross O2 gain, uses 10s of liqO2 (GDD 5-C)', () => {
    let s = initialState()
    s.o2Tank = 50
    s.o2Held = true
    const steps = Math.round(10 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = oxygen(s, FIXED_DT)
    // Gross gain: +0.8×10 = +8%, net drain: −0.18×10 = −1.8%, result: 50+8−1.8 = 56.2
    expect(s.o2Tank).toBeCloseTo(56.2, 0)
    // liqO2: 30 − 10 = 20 (2 tanks remaining)
    expect(s.liqO2).toBeCloseTo(20, 0)
  })

  it('o2Tank caps at 100% even with excess release', () => {
    let s = initialState()
    s.o2Tank = 99
    s.o2Held = true
    s = oxygen(s, 5)  // would add 0.8×5 = 4%, but capped at 100
    expect(s.o2Tank).toBeLessThanOrEqual(100)
  })

  it('release stops when liqO2 runs out', () => {
    let s = initialState()
    s.liqO2 = 0
    s.o2Held = true
    s = oxygen(s, 1)
    expect(s.o2Releasing).toBe(false)
  })

  it('release blocked during brownout', () => {
    let s = initialState()
    s.o2Held = true
    s.brownout = true
    s = oxygen(s, 1)
    expect(s.o2Releasing).toBe(false)
  })
})
