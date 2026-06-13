import {
  ETA_INIT, PWR_INIT, O2_INIT, LIQO2_INIT,
  CO2_INIT, TEMP_INIT, DEV_INIT,
  AMP,
} from './constants'

export type DeviceId = 'heater' | 'co2Filter' | 'navComp'

export type DeviceState = {
  on: boolean
  heat: number        // 熱量計（D-005）
  lockUntil: number   // 鎖定到 elapsed 的哪秒；0 = 沒鎖
  degraded: boolean   // 跳電 50% 機率永久降效
}

export type Phase = 'cutscene' | 'playing' | 'win' | 'lose'
export type LoseReason = 'power' | 'oxygen' | 'co2' | 'temp' | 'deviation'

export type GameState = {
  phase: Phase
  loseReason: LoseReason | null
  elapsed: number        // playing 開始後 real seconds

  // 7 組儀表數值（GDD §7-A）
  eta: number            // MET 秒，初始 313200；顯示格式化成 HH:MM:SS
  mainPwr: number        // %，只降不升
  o2Tank: number         // %
  liqO2: number          // 剩餘長按秒數，初始 30；顯示 ceil(liqO2/10) 個罐
  co2: number            // PPM
  temp: number           // °C
  dev: number            // %

  devices: Record<DeviceId, DeviceState>
  o2Held: boolean        // O2 釋放閥是否被按住
  brownout: boolean      // 是否跳電中（等 RESET）

  // 模擬簿記（不顯示）
  rng: () => number
  o2Releasing: boolean        // 本幀是否實際在釋放 O2（oxygen 算、temp 讀）
  devDriftAcc: number         // DEV 漂移秒累加器（D-003）
  devDriftSample: number      // 本模擬秒抽到的漂移率
  dev30PenaltyApplied: boolean
  lastDeviceOn: DeviceId | null
  ampOverRedSeconds: number
}

function makeDevice(): DeviceState {
  return { on: false, heat: 0, lockUntil: 0, degraded: false }
}

export function initialState(): GameState {
  return {
    phase: 'playing',
    loseReason: null,
    elapsed: 0,
    eta: ETA_INIT,
    mainPwr: PWR_INIT,
    o2Tank: O2_INIT,
    liqO2: LIQO2_INIT,
    co2: CO2_INIT,
    temp: TEMP_INIT,
    dev: DEV_INIT,
    devices: {
      heater: makeDevice(),
      co2Filter: makeDevice(),
      navComp: makeDevice(),
    },
    o2Held: false,
    brownout: false,
    rng: Math.random,
    o2Releasing: false,
    devDriftAcc: 0,
    devDriftSample: 0,
    dev30PenaltyApplied: false,
    lastDeviceOn: null,
    ampOverRedSeconds: 0,
  }
}

// 衍生值：不存 state，每幀現算（D-008）
export function computeAmp(s: GameState): number {
  let amp = 0
  if (s.devices.heater.on)    amp += AMP.heater
  if (s.devices.co2Filter.on) amp += AMP.co2Filter
  if (s.devices.navComp.on)   amp += AMP.navComp
  if (s.o2Releasing)          amp += AMP.o2Release
  return amp
}
