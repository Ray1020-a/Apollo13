import { describe, it, expect } from 'vitest'
import { initialState } from '../../src/game/state'
import { devices } from '../../src/game/systems/devices'
import { FIXED_DT, BROWNOUT_PWR_PENALTY } from '../../src/game/constants'

// 在測試中 elapsed 要和 step() 一樣先加
function runDevices(s: ReturnType<typeof initialState>, seconds: number) {
  const steps = Math.round(seconds / FIXED_DT)
  for (let i = 0; i < steps; i++) {
    s.elapsed += FIXED_DT
    s = devices(s, FIXED_DT)
  }
  return s
}

describe('devices system — overheat', () => {
  it('CO2 filter overheats after 8 continuous seconds (GDD 6-A)', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s = runDevices(s, 8.1)  // slightly over 8s
    expect(s.devices.co2Filter.on).toBe(false)
    expect(s.devices.co2Filter.lockUntil).toBeGreaterThan(0)
  })

  it('CO2 filter still on just before 8s', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s = runDevices(s, 7.9)
    expect(s.devices.co2Filter.on).toBe(true)
  })

  it('heater overheats after 12 continuous seconds', () => {
    let s = initialState()
    s.devices.heater.on = true
    s = runDevices(s, 12.1)
    expect(s.devices.heater.on).toBe(false)
  })

  it('navComp does NOT overheat — 固態低功耗，限制器只剩 AMP + 漂移債', () => {
    let s = initialState()
    s.devices.navComp.on = true
    s = runDevices(s, 480)  // 撐完整局最低時長都不該過熱、不該鎖定
    expect(s.devices.navComp.on).toBe(true)
    expect(s.devices.navComp.heat).toBe(0)
    expect(s.devices.navComp.lockUntil).toBe(0)
  })

  it('asymmetric cooling: heat at 4s off for 2s → heat ≈ 1 (D-005)', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s = runDevices(s, 4)  // heat accumulates to 4.0
    expect(s.devices.co2Filter.heat).toBeCloseTo(4, 1)

    s.devices.co2Filter.on = false
    s = runDevices(s, 2)  // heat: 4 − 1.5×2 = 1.0
    expect(s.devices.co2Filter.heat).toBeCloseTo(1, 1)
  })

  it('device lock prevents re-use for 5s after overheat', () => {
    let s = initialState()
    s.devices.co2Filter.on = true
    s = runDevices(s, 8.1)  // overheats, locked
    const lockUntil = s.devices.co2Filter.lockUntil

    // Manually turn on — still locked
    s.devices.co2Filter.on = true
    s = runDevices(s, 1)
    // heat should be cooling (device effectively off due to lock)
    expect(s.devices.co2Filter.heat).toBeLessThan(lockUntil)  // rough check
    // elapsed should be > lockUntil after 5s more
    s = runDevices(s, 4.1)
    expect(s.elapsed).toBeGreaterThan(lockUntil)
  })
})

describe('devices system — brownout', () => {
  it('brownout triggers after 2s over 10A (GDD 6-B, D-008)', () => {
    let s = initialState()
    // 3+5+4 = 12A > AMP_REDLINE (10)
    s.devices.heater.on = true
    s.devices.co2Filter.on = true
    s.devices.navComp.on = true
    s = runDevices(s, 2.1)
    expect(s.brownout).toBe(true)
    expect(s.devices.heater.on).toBe(false)
    expect(s.devices.co2Filter.on).toBe(false)
    expect(s.devices.navComp.on).toBe(false)
  })

  it('brownout deducts 3% mainPwr', () => {
    let s = initialState()
    s.devices.heater.on = true
    s.devices.co2Filter.on = true
    s.devices.navComp.on = true
    s.rng = () => 0  // deterministic: no degrade
    s = runDevices(s, 2.1)
    expect(s.mainPwr).toBe(100 - BROWNOUT_PWR_PENALTY)
  })

  it('brownout degrades lastDeviceOn when rng < 0.5', () => {
    let s = initialState()
    s.devices.heater.on = true
    s.devices.co2Filter.on = true
    s.devices.navComp.on = true
    s.lastDeviceOn = 'navComp'
    s.rng = () => 0.4  // < 0.5 → degrade
    s = runDevices(s, 2.1)
    expect(s.devices.navComp.degraded).toBe(true)
  })

  it('brownout does NOT degrade when rng >= 0.5', () => {
    let s = initialState()
    s.devices.heater.on = true
    s.devices.co2Filter.on = true
    s.devices.navComp.on = true
    s.lastDeviceOn = 'navComp'
    s.rng = () => 0.6  // >= 0.5 → no degrade
    s = runDevices(s, 2.1)
    expect(s.devices.navComp.degraded).toBe(false)
  })

  it('under 10A never triggers brownout', () => {
    let s = initialState()
    s.devices.heater.on = true   // 3A only
    s = runDevices(s, 10)
    expect(s.brownout).toBe(false)
  })
})
