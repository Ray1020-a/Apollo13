import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { nav } from '../../src/game/systems/nav'
import { FIXED_DT, ETA_INIT, COMPRESSION, DEV_BIG_PENALTY } from '../../src/game/constants'
import { mulberry32 } from '../helpers'

describe('nav system', () => {
  it('nav on: ETA decreases by 652.5× compression; 480 real-s empties it', () => {
    let s = initialState()
    s.devices.navComp.on = true
    const steps = Math.round(480 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    // 313200 − 652.5×480 = 313200 − 313200 = 0
    expect(s.eta).toBeCloseTo(0, 0)
  })

  it('nav on: DEV corrects at 1%/s', () => {
    let s = initialState()
    s.dev = 10
    s.devices.navComp.on = true
    const steps = Math.round(5 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    // 10 − 1×5 = 5%
    expect(s.dev).toBeCloseTo(5, 1)
  })

  it('nav on: degraded navComp corrects at 0.6%/s', () => {
    let s = initialState()
    s.dev = 10
    s.devices.navComp.on = true
    s.devices.navComp.degraded = true
    const steps = Math.round(5 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    // 10 − 0.6×5 = 7%
    expect(s.dev).toBeCloseTo(7, 1)
  })

  it('nav off: DEV drifts at max 2%/sim-s at normal temp (rng=1)', () => {
    let s = initialState()
    s.rng = () => 1           // always-max RNG
    s.devDriftAcc = 1         // simulate "just turned off nav" ready state (D-003)
    const steps = Math.round(1 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    // max drift = DEV_DRIFT_MAX = 2 per sim-second
    expect(s.dev).toBeCloseTo(2, 1)
  })

  it('nav off: cold temp (<10°C) expands drift to max 3%/sim-s (rng=1)', () => {
    let s = initialState()
    s.rng = () => 1
    s.devDriftAcc = 1
    s.temp = 5  // < TEMP_FROST (10)
    const steps = Math.round(1 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    expect(s.dev).toBeCloseTo(3, 1)
  })

  it('nav off: rng=0 produces zero drift', () => {
    let s = initialState()
    s.rng = () => 0
    s.devDriftAcc = 1
    const steps = Math.round(2 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    expect(s.dev).toBe(0)
  })

  it('DEV >30% adds ETA penalty of 30 real-s × 652.5 exactly once', () => {
    let s = initialState()
    const etaBefore = s.eta
    s.dev = 31  // already above threshold

    s = nav(s, FIXED_DT)  // should trigger penalty

    const expected = etaBefore + DEV_BIG_PENALTY * COMPRESSION
    expect(s.eta).toBeCloseTo(expected, 0)
    expect(s.dev30PenaltyApplied).toBe(true)

    // Second call with nav off (drift) — penalty should NOT fire again
    s.rng = () => 0  // no more drift
    const etaAfterPenalty = s.eta
    s = nav(s, FIXED_DT)
    expect(s.eta).toBeCloseTo(etaAfterPenalty, 0)
  })

  it('nav off: consistent drift with seeded RNG over 10s', () => {
    let s = initialState()
    s.rng = mulberry32(42)
    s.devDriftAcc = 1
    const steps = Math.round(10 / FIXED_DT)
    for (let i = 0; i < steps; i++) s = nav(s, FIXED_DT)
    // Should be within [0, 20] (max 2%/s × 10s)
    expect(s.dev).toBeGreaterThanOrEqual(0)
    expect(s.dev).toBeLessThanOrEqual(20)
  })
})
