import type { GameState, DeviceId } from '../src/game/state'
import { computeAmp } from '../src/game/state'
import { AMP, AMP_REDLINE, OVERHEAT_LIMIT } from '../src/game/constants'
import type { PlayerAgent, PlayerIntent } from './playerAgent'
import { IDLE } from './playerAgent'

// rotate 策略的決策門檻（具名常數方便調）
const ROTATE_DEV_DANGER = 35      // % → 優先開導航壓回來
const ROTATE_CO2_DANGER = 7000    // PPM → 優先開濾毒
const ROTATE_TEMP_DANGER = 7      // °C → 優先開暖氣
const ROTATE_O2_DANGER = 25       // % → 優先補氧
const ROTATE_HEAT_RATIO = 0.8     // 達過熱上限幾成就主動關掉

// ─────────────────────────────────────────────────────────────────────────────

export const doNothing: PlayerAgent = {
  name: 'do-nothing',
  description: '完全不操作，驗證不操作的死法（真實 RNG 下 DEV 先殺）',
  decide: () => IDLE,
}

export const co2Only: PlayerAgent = {
  name: 'co2-only',
  description: '只管濾毒，驗證單顧 CO2 的隧道視野（DEV 仍會殺）',
  decide(s, _t): PlayerIntent {
    const toggles: DeviceId[] = []
    const d = s.devices.co2Filter
    if (!d.on && s.elapsed >= d.lockUntil) toggles.push('co2Filter')
    return { toggles, o2Held: false, reset: false }
  },
}

export const panic: PlayerAgent = {
  name: 'panic',
  description: '第 0 秒全開設備 + 補氧，驗證跳電機制與懲罰',
  decide(_s, t): PlayerIntent {
    if (t === 0) return { toggles: ['heater', 'co2Filter', 'navComp'], o2Held: true, reset: false }
    return IDLE
  },
}

export const navOnly: PlayerAgent = {
  name: 'nav-only',
  description: '只管導航，驗證壓住 DEV 但 CO2 牆還在（約 480s co2 死）',
  decide(s, _t): PlayerIntent {
    const toggles: DeviceId[] = []
    const d = s.devices.navComp
    if (!d.on && s.elapsed >= d.lockUntil) toggles.push('navComp')
    return { toggles, o2Held: false, reset: false }
  },
}

export function makeRotateAgent(): PlayerAgent {
  return {
    name: 'rotate',
    description: '分時輪轉：按「離死線多近」決定優先序，目標讓 ETA 歸零',
    decide(s: Readonly<GameState>, _t: number): PlayerIntent {
      const toggles: DeviceId[] = []
      let o2Held = false
      let reset = false

      // 1. 跳電中先 reset
      if (s.brownout) { reset = true; return { toggles, o2Held, reset } }

      // 主動散熱：接近過熱上限就關掉讓它冷，避免引擎強制鎖定
      // 只看會過熱的設備（OVERHEAT_LIMIT 表）；navComp 不過熱，導航全程開
      for (const id of Object.keys(OVERHEAT_LIMIT) as (keyof typeof OVERHEAT_LIMIT)[]) {
        const d = s.devices[id]
        if (d.on && d.heat >= OVERHEAT_LIMIT[id] * ROTATE_HEAT_RATIO) {
          toggles.push(id)
          return { toggles, o2Held, reset }
        }
      }

      // 開某設備前先估算 AMP 會不會超線
      function canAdd(amp: number): boolean {
        return computeAmp(s as GameState) + amp <= AMP_REDLINE
      }
      function isAvailable(id: DeviceId): boolean {
        return !s.devices[id].on && s.elapsed >= s.devices[id].lockUntil
      }

      // 2. DEV 危險 → 開導航
      if (s.dev > ROTATE_DEV_DANGER && isAvailable('navComp') && canAdd(AMP.navComp)) {
        toggles.push('navComp')
        return { toggles, o2Held, reset }
      }

      // 3. CO2 危險 → 開濾毒
      if (s.co2 > ROTATE_CO2_DANGER && isAvailable('co2Filter') && canAdd(AMP.co2Filter)) {
        toggles.push('co2Filter')
        return { toggles, o2Held, reset }
      }

      // 4. TEMP 危險 → 開暖氣
      if (s.temp < ROTATE_TEMP_DANGER && isAvailable('heater') && canAdd(AMP.heater)) {
        toggles.push('heater')
        return { toggles, o2Held, reset }
      }

      // 5. O2 危險 → 補氧（補氧會降溫，跟暖氣衝突，選其一）
      if (s.o2Tank < ROTATE_O2_DANGER && s.liqO2 > 0 && canAdd(AMP.o2Release)) {
        o2Held = true
        return { toggles, o2Held, reset }
      }

      // 6. 平時：盡量開導航推 ETA（贏的唯一途徑）
      if (isAvailable('navComp') && canAdd(AMP.navComp)) {
        toggles.push('navComp')
      }

      return { toggles, o2Held, reset }
    },
  }
}

export const STRATEGIES: PlayerAgent[] = [
  doNothing,
  co2Only,
  panic,
  navOnly,
  makeRotateAgent(),
]
